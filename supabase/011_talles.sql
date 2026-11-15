-- ============================================================================
-- 011 · TALLES Y COLORES (VARIANTES) CON STOCK PROPIO
-- Cada producto puede tener opciones (talles, colores o combinaciones como "Negro M"),
-- cada una con su stock. El stock total del producto es la suma y se calcula solo.
--   products.variants       [{"name": "S", "stock": 3}, {"name": "M", "stock": 5}, ...]
--   products.variant_label  cómo se llama la opción en la tienda: "Talle", "Color"...
-- Al comprar se elige la opción: la base valida y reserva el stock DE ESA OPCIÓN, y al
-- confirmarse el pago lo descuenta de esa opción. Los productos sin opciones siguen igual.
--
-- Requiere 006. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists variant_label text not null default 'Talle';

-- ── Normaliza las opciones y mantiene el stock total como la suma ───────────
create or replace function public.products_sync_variant_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.variants is null or jsonb_typeof(new.variants) <> 'array' then
    new.variants := '[]'::jsonb;
  end if;
  new.variant_label := coalesce(nullif(left(trim(new.variant_label), 30), ''), 'Talle');

  if jsonb_array_length(new.variants) > 0 then
    -- Nombre recortado, stock entero no negativo, sin opciones vacías ni repetidas
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'stock', t.stock) order by t.ord), '[]'::jsonb)
    into new.variants
    from (
      select distinct on (lower(left(trim(v ->> 'name'), 40)))
             left(trim(v ->> 'name'), 40) as name,
             greatest(coalesce(floor((v ->> 'stock')::numeric), 0), 0)::integer as stock,
             ord
      from jsonb_array_elements(new.variants) with ordinality as e(v, ord)
      where coalesce(trim(v ->> 'name'), '') <> ''
      order by lower(left(trim(v ->> 'name'), 40)), ord
    ) t;

    if jsonb_array_length(new.variants) > 0 then
      new.stock := (select coalesce(sum((v ->> 'stock')::integer), 0) from jsonb_array_elements(new.variants) v);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_variant_stock on public.products;
create trigger products_sync_variant_stock
before insert or update of variants, stock, variant_label on public.products
for each row execute function public.products_sync_variant_stock();

-- Suma (o resta) unidades a una opción
create or replace function public.variant_add(p_variants jsonb, p_name text, p_delta integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           case when v ->> 'name' = p_name
             then jsonb_set(v, '{stock}', to_jsonb(greatest(coalesce((v ->> 'stock')::integer, 0) + p_delta, 0)))
             else v end
           order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) with ordinality as e(v, ord);
$$;

-- ── Unidades reservadas por opción (órdenes sin pagar y sin vencer) ─────────
create or replace function public.get_reserved_variants(p_store_id uuid default null)
returns table (product_id uuid, variant text, reserved integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (item ->> 'id')::uuid, coalesce(item ->> 'variant', ''), sum((item ->> 'quantity')::integer)::integer
  from public.orders o
  cross join lateral jsonb_array_elements(o.items::jsonb) as item
  where o.status in ('reservado', 'pendiente')
    and (p_store_id is null or o.store_id = p_store_id)
    and (
      (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
      or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
    )
  group by 1, 2;
$$;

-- ── Crear una orden: como en 006, más la opción elegida de cada producto ─────
create or replace function public.create_order(
  p_name text,
  p_email text,
  p_phone text,
  p_document text,
  p_address jsonb,
  p_payment_method text,
  p_items jsonb,
  p_store_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid := coalesce(p_store_id, '00000000-0000-0000-0000-000000000001'::uuid);
  v_store_status text;
  v_sales_enabled boolean;
  v_shipping numeric := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_reserved integer;
  v_available integer;
  v_variant text;
  v_label text;
  v_unit numeric;
  v_subtotal numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_email text;
  v_order_id uuid;
  v_total numeric;
begin
  select s.status, s.sales_enabled into v_store_status, v_sales_enabled
  from public.stores s where s.id = v_store;
  if v_store_status is distinct from 'active' then
    raise exception 'La tienda no está disponible.';
  end if;
  if not v_sales_enabled then
    raise exception 'Esta tienda todavía no está habilitada para vender.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if p_payment_method is null or p_payment_method not in ('MercadoPago', 'Transferencia') then
    raise exception 'Medio de pago inválido.';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_document), '') = '' then
    raise exception 'Faltan datos de contacto.';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', nullif(trim(p_email), ''));
  if v_email is null then
    raise exception 'Falta el email.';
  end if;

  select coalesce(s.shipping_cost, 0) into v_shipping
  from public.store_settings s
  where s.store_id = v_store;
  v_shipping := coalesce(v_shipping, 0);

  perform public.release_expired_reservations();

  -- Se recorre por id para bloquear siempre en el mismo orden (evita bloqueos cruzados)
  for v_item in
    select e.value from jsonb_array_elements(p_items) as e order by e.value ->> 'id', e.value ->> 'variant'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Cantidad inválida.';
    end if;

    select * into v_product
    from public.products p
    where p.id = (v_item ->> 'id')::uuid and p.is_active and p.store_id = v_store
    for update;
    if not found then
      raise exception 'Un producto del carrito ya no está disponible.';
    end if;

    v_variant := nullif(trim(coalesce(v_item ->> 'variant', '')), '');
    v_label := coalesce(nullif(v_product.variant_label, ''), 'Talle');

    if jsonb_array_length(coalesce(v_product.variants, '[]'::jsonb)) > 0 then
      -- Producto con opciones: hay que elegir una, y el stock es el de esa opción
      if v_variant is null then
        raise exception 'Elegí el % de "%".', lower(v_label), v_product.name;
      end if;
      select (v ->> 'stock')::integer into v_available
      from jsonb_array_elements(v_product.variants) v
      where v ->> 'name' = v_variant
      limit 1;
      if v_available is null then
        raise exception '"%" ya no tiene el % %.', v_product.name, lower(v_label), v_variant;
      end if;

      select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
      from public.orders o
      cross join lateral jsonb_array_elements(o.items::jsonb) as i
      where o.status in ('reservado', 'pendiente')
        and o.store_id = v_store
        and (
          (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
          or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
        )
        and (i ->> 'id')::uuid = v_product.id
        and i ->> 'variant' = v_variant;
    else
      v_variant := null;
      v_available := v_product.stock;
      select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
      from public.orders o
      cross join lateral jsonb_array_elements(o.items::jsonb) as i
      where o.status in ('reservado', 'pendiente')
        and o.store_id = v_store
        and (
          (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
          or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
        )
        and (i ->> 'id')::uuid = v_product.id;
    end if;

    -- Disponible = stock físico menos lo que otros clientes tienen reservado
    if v_available - v_reserved < v_qty then
      if v_variant is null then
        raise exception 'No hay suficiente stock de "%".', v_product.name;
      else
        raise exception 'No hay suficiente stock de "%" (% %).', v_product.name, lower(v_label), v_variant;
      end if;
    end if;

    v_unit := round(
      (case when coalesce(v_product.discount, 0) > 0
        then v_product.price * (1 - v_product.discount / 100.0)
        else v_product.price
      end)::numeric, 2);
    v_subtotal := v_subtotal + v_unit * v_qty;

    v_items := v_items || jsonb_build_object(
      'id', v_product.id,
      -- El nombre ya lleva la opción: así se ve en pedidos, comprobantes, mails y seguimiento
      'name', v_product.name || case when v_variant is not null then ' — ' || v_label || ' ' || v_variant else '' end,
      'product_name', v_product.name,
      'variant', v_variant,
      'price', v_product.price,
      'discount', coalesce(v_product.discount, 0),
      'unit_price', v_unit,
      'quantity', v_qty,
      'category', v_product.category,
      'barcode', v_product.barcode,
      'imageUrl', case
        when left(coalesce(v_product.image_url, ''), 1) = '[' then (v_product.image_url::jsonb ->> 0)
        else v_product.image_url
      end
    );
  end loop;

  v_total := v_subtotal + v_shipping;

  insert into public.orders (
    customer_name, customer_email, customer_phone, customer_document,
    shipping_address, payment_method, items, total, shipping_cost, status, user_id, store_id
  ) values (
    trim(p_name), v_email, p_phone, trim(p_document),
    p_address, p_payment_method, v_items, v_total, v_shipping,
    'reservado',
    auth.uid(),
    v_store
  )
  returning id into v_order_id;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'shipping_cost', v_shipping);
end;
$$;

-- ── Pago confirmado: descuenta de la opción vendida (el total se recalcula solo) ──
create or replace function public.mark_order_paid(p_order_id uuid, p_paid_amount numeric default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_stock numeric;
  v_qty integer;
  v_variant text;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if not (public.is_trusted_caller() or public.is_store_admin(v_order.store_id)) then
    raise exception 'No autorizado.';
  end if;

  if not (
    v_order.status like 'reservado%'
    or v_order.status like 'pendiente%'
    or v_order.status = 'cancelado (tiempo agotado)'
  ) then
    return v_order.status;
  end if;

  if p_paid_amount is not null and p_paid_amount + 1 < v_order.total then
    raise exception 'El pago (%) no cubre el total de la orden (%).', p_paid_amount, v_order.total;
  end if;

  for v_item in select e.value from jsonb_array_elements(v_order.items::jsonb) as e loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_variant := nullif(v_item ->> 'variant', '');

    update public.products p
    set variants = case when v_variant is not null and jsonb_array_length(p.variants) > 0
                     then public.variant_add(p.variants, v_variant, -v_qty) else p.variants end,
        stock = case when v_variant is not null and jsonb_array_length(p.variants) > 0
                  then p.stock else p.stock - v_qty end
    where p.id = (v_item ->> 'id')::uuid and p.store_id = v_order.store_id
    returning p.stock into v_stock;

    if found then
      insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note, store_id)
      values (
        (v_item ->> 'id')::uuid,
        -v_qty,
        v_stock,
        'Venta',
        'Orden #' || left(v_order.id::text, 8) || coalesce(' · ' || v_variant, ''),
        v_order.store_id
      );
    end if;
  end loop;

  update public.orders o set status = 'pagado' where o.id = p_order_id;
  return 'pagado';
end;
$$;

-- ── Ajuste manual de stock desde el panel, ahora también por opción ──────────
drop function if exists public.adjust_stock(uuid, integer, text, text);
create or replace function public.adjust_stock(p_product_id uuid, p_delta integer, p_reason text, p_note text default '', p_variant text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_after numeric;
  v_variant text := nullif(trim(coalesce(p_variant, '')), '');
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'La cantidad del ajuste no puede ser cero.';
  end if;

  select * into v_product from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  if not public.is_store_admin(v_product.store_id) then
    raise exception 'No autorizado.';
  end if;

  if jsonb_array_length(v_product.variants) > 0 then
    if v_variant is null or not exists (select 1 from jsonb_array_elements(v_product.variants) v where v ->> 'name' = v_variant) then
      raise exception 'Elegí a qué % se le ajusta el stock.', lower(v_product.variant_label);
    end if;
    update public.products p set variants = public.variant_add(p.variants, v_variant, p_delta)
    where p.id = p_product_id returning p.stock into v_after;
  else
    v_after := greatest(v_product.stock + p_delta, 0);
    update public.products p set stock = v_after where p.id = p_product_id;
  end if;

  insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note, store_id)
  values (p_product_id, v_after - v_product.stock, v_after,
          coalesce(nullif(trim(p_reason), ''), 'Ajuste Manual'),
          trim(coalesce(p_note, '') || coalesce(' · ' || v_variant, '')),
          v_product.store_id);

  return v_after;
end;
$$;

-- ── Cambiar los talles de un producto desde el panel ──────────────────────────
-- Recibe solo los NOMBRES: cada talle que sigue conserva su stock real (el de la base, no el
-- que mostraba la pantalla, por si entró una venta mientras se editaba); los nuevos arrancan
-- en 0 y se cargan con un ajuste. Si el total cambia (talles quitados, o un producto que pasa
-- de no tener talles a tenerlos), queda registrado en el historial de stock.
create or replace function public.set_product_variants(p_product_id uuid, p_label text, p_names jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_new jsonb;
  v_after numeric;
begin
  select * into v_product from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  if not public.is_store_admin(v_product.store_id) then
    raise exception 'No autorizado.';
  end if;
  if p_names is null or jsonb_typeof(p_names) <> 'array' then
    raise exception 'Lista de talles inválida.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', n.name,
           'stock', coalesce((
             select (v ->> 'stock')::integer from jsonb_array_elements(v_product.variants) v
             where lower(v ->> 'name') = lower(n.name) limit 1), 0)
         ) order by n.ord), '[]'::jsonb)
  into v_new
  from (
    select left(trim(x #>> '{}'), 40) as name, ord
    from jsonb_array_elements(p_names) with ordinality as e(x, ord)
    where jsonb_typeof(x) = 'string' and coalesce(trim(x #>> '{}'), '') <> ''
  ) n;

  update public.products p
  set variants = v_new,
      variant_label = coalesce(nullif(trim(p_label), ''), p.variant_label)
  where p.id = p_product_id
  returning p.stock into v_after;

  if v_after <> v_product.stock then
    insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note, store_id)
    values (p_product_id, v_after - v_product.stock, v_after, 'Cambio de talles',
            case when jsonb_array_length(v_product.variants) = 0
              then 'Ahora el stock se carga por talle'
              else 'Se quitaron talles con stock' end,
            v_product.store_id);
  end if;

  return (select p.variants from public.products p where p.id = p_product_id);
end;
$$;

-- ── Tienda de muestra (MINIMAL, 010): sus productos de ejemplo pasan a tener talles ──
update public.products
set variants = case
      when category in ('Bermudas', 'Pantalones')
        then '[{"name":"38","stock":2},{"name":"40","stock":3},{"name":"42","stock":3},{"name":"44","stock":1}]'::jsonb
      else '[{"name":"S","stock":2},{"name":"M","stock":4},{"name":"L","stock":3},{"name":"XL","stock":0}]'::jsonb
    end,
    variant_label = 'Talle'
where store_id = '00000000-0000-0000-0000-000000000001'
  and image_url like '/demo/%'
  and jsonb_array_length(variants) = 0;

revoke all on function public.set_product_variants(uuid, text, jsonb) from public;
grant execute on function public.set_product_variants(uuid, text, jsonb) to authenticated;

revoke all on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) from public;
grant execute on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) to anon, authenticated, service_role;
grant execute on function public.get_reserved_variants(uuid) to anon, authenticated, service_role;
revoke all on function public.mark_order_paid(uuid, numeric) from public;
grant execute on function public.mark_order_paid(uuid, numeric) to authenticated, service_role;
revoke all on function public.adjust_stock(uuid, integer, text, text, text) from public;
grant execute on function public.adjust_stock(uuid, integer, text, text, text) to authenticated;

notify pgrst, 'reload schema';
