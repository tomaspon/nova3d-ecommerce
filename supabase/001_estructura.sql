-- ============================================================================
-- 001 · ESTRUCTURA
-- Agrega columnas y funciones. NO cambia permisos: la tienda sigue funcionando
-- igual después de correrlo. Se puede ejecutar más de una vez sin problema.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

-- ── Columnas nuevas ─────────────────────────────────────────────────────────

alter table public.store_settings
  add column if not exists store_name text,
  add column if not exists store_email text,
  add column if not exists shipping_cost numeric not null default 0,
  add column if not exists allow_backorders boolean not null default false;

alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists shipping_cost numeric not null default 0,
  add column if not exists carrier text,
  add column if not exists tracking_code text,
  add column if not exists shipped_at timestamptz;

create index if not exists orders_customer_document_idx on public.orders (customer_document);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- ── Quién es quién ──────────────────────────────────────────────────────────

-- Administrador: usuario cuyo app_metadata tiene role = "admin"
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Administrador o el servidor de la tienda (funciones de Vercel con la service role key)
create or replace function public.is_trusted_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin() or coalesce((auth.jwt() ->> 'role') = 'service_role', false);
$$;

-- ── Reservas ────────────────────────────────────────────────────────────────

-- Cancela las órdenes sin pagar vencidas: 10 minutos (MercadoPago) o 48 horas (transferencia)
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.orders
  set status = 'cancelado (tiempo agotado)'
  where status in ('reservado', 'pendiente')
    and (
      (coalesce(payment_method, '') <> 'Transferencia' and created_at < now() - interval '10 minutes')
      or (payment_method = 'Transferencia' and created_at < now() - interval '48 hours')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Unidades reservadas por órdenes sin pagar que siguen vigentes, por producto
create or replace function public.get_reserved_stock()
returns table (product_id uuid, reserved integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (item ->> 'id')::uuid, sum((item ->> 'quantity')::integer)::integer
  from public.orders o
  cross join lateral jsonb_array_elements(o.items::jsonb) as item
  where o.status in ('reservado', 'pendiente')
    and (
      (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
      or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
    )
  group by 1;
$$;

-- ── Crear una orden ─────────────────────────────────────────────────────────
-- Precios, descuentos, envío y total se calculan acá con los datos de la base.
-- Las filas de producto se bloquean mientras se valida el stock, así dos compras
-- simultáneas no pueden reservar la misma unidad.

create or replace function public.create_order(
  p_name text,
  p_email text,
  p_phone text,
  p_document text,
  p_address jsonb,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allow_backorders boolean := false;
  v_shipping numeric := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_reserved integer;
  v_unit numeric;
  v_subtotal numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_backorder boolean := false;
  v_email text;
  v_order_id uuid;
  v_total numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if p_payment_method is null or p_payment_method not in ('MercadoPago', 'Transferencia') then
    raise exception 'Medio de pago inválido.';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_document), '') = '' then
    raise exception 'Faltan datos de contacto.';
  end if;

  -- Con sesión iniciada, la orden queda con el email de la cuenta
  v_email := coalesce(auth.jwt() ->> 'email', nullif(trim(p_email), ''));
  if v_email is null then
    raise exception 'Falta el email.';
  end if;

  select coalesce(s.allow_backorders, false), coalesce(s.shipping_cost, 0)
  into v_allow_backorders, v_shipping
  from public.store_settings s
  where s.id = 1;
  v_allow_backorders := coalesce(v_allow_backorders, false);
  v_shipping := coalesce(v_shipping, 0);

  perform public.release_expired_reservations();

  -- Se recorre por id para bloquear siempre en el mismo orden (evita bloqueos cruzados)
  for v_item in
    select e.value from jsonb_array_elements(p_items) as e order by e.value ->> 'id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Cantidad inválida.';
    end if;

    select * into v_product
    from public.products p
    where p.id = (v_item ->> 'id')::uuid and p.is_active
    for update;

    if not found then
      raise exception 'Un producto del carrito ya no está disponible.';
    end if;

    select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
    from public.orders o
    cross join lateral jsonb_array_elements(o.items::jsonb) as i
    where o.status in ('reservado', 'pendiente')
      and (
        (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
        or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
      )
      and (i ->> 'id')::uuid = v_product.id;

    if v_product.stock - v_reserved < v_qty then
      if v_allow_backorders then
        v_backorder := true;
      else
        raise exception 'No hay suficiente stock de "%".', v_product.name;
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
      'name', v_product.name,
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
    shipping_address, payment_method, items, total, shipping_cost, status, user_id
  ) values (
    trim(p_name), v_email, p_phone, trim(p_document),
    p_address, p_payment_method, v_items, v_total, v_shipping,
    case when v_backorder then 'pendiente (reserva)' else 'reservado' end,
    auth.uid()
  )
  returning id into v_order_id;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'shipping_cost', v_shipping);
end;
$$;

-- ── Marcar una orden como pagada ────────────────────────────────────────────
-- Solo para administradores o el servidor. Descuenta el stock en una sola
-- operación por producto y deja el registro en inventory_logs.

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
  v_new_status text;
begin
  if not public.is_trusted_caller() then
    raise exception 'No autorizado.';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  -- Ya estaba pagada o en una etapa posterior: no se toca
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
    update public.products p
    set stock = p.stock - (v_item ->> 'quantity')::integer
    where p.id = (v_item ->> 'id')::uuid
    returning p.stock into v_stock;

    if found then
      insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note)
      values (
        (v_item ->> 'id')::uuid,
        -(v_item ->> 'quantity')::integer,
        v_stock,
        'Venta',
        'Orden #' || left(v_order.id::text, 8)
      );
    end if;
  end loop;

  v_new_status := case when v_order.status = 'pendiente (reserva)' then 'pagado (reserva)' else 'pagado' end;
  update public.orders o set status = v_new_status where o.id = p_order_id;
  return v_new_status;
end;
$$;

-- ── Seguimiento para el cliente ─────────────────────────────────────────────

-- Por enlace de compra: el id completo de la orden funciona como clave, así que
-- se devuelve el detalle con la dirección de entrega (sin nombre, DNI ni teléfono).
create or replace function public.get_order_public(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(x)
  from (
    select o.id, o.created_at, o.status, o.total, o.shipping_cost, o.payment_method,
           o.items, o.shipping_address, o.carrier, o.tracking_code, o.shipped_at
    from public.orders o
    where o.id = p_order_id
  ) x;
$$;

-- Por DNI: solo estado, artículos y datos del envío. Sin dirección, sin datos
-- personales y sin el id completo (no sirve para abrir el detalle con dirección).
create or replace function public.track_orders_by_document(p_document text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  from (
    select left(o.id::text, 8) as short_id,
           o.created_at, o.status, o.total, o.shipping_cost, o.payment_method,
           o.carrier, o.tracking_code, o.shipped_at,
           (
             select coalesce(jsonb_agg(jsonb_build_object(
               'name', i ->> 'name',
               'quantity', (i ->> 'quantity')::integer,
               'price', (i ->> 'price')::numeric,
               'discount', coalesce((i ->> 'discount')::numeric, 0)
             )), '[]'::jsonb)
             from jsonb_array_elements(o.items::jsonb) as i
           ) as items
    from public.orders o
    where length(trim(coalesce(p_document, ''))) >= 6
      and o.customer_document = trim(p_document)
      and o.status not ilike 'cancelado%'
    order by o.created_at desc
    limit 20
  ) t;
$$;

-- ── Quién puede ejecutar cada función ───────────────────────────────────────

revoke all on function public.release_expired_reservations() from public;
revoke all on function public.get_reserved_stock() from public;
revoke all on function public.create_order(text, text, text, text, jsonb, text, jsonb) from public;
revoke all on function public.mark_order_paid(uuid, numeric) from public;
revoke all on function public.get_order_public(uuid) from public;
revoke all on function public.track_orders_by_document(text) from public;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_trusted_caller() to anon, authenticated, service_role;
grant execute on function public.release_expired_reservations() to anon, authenticated, service_role;
grant execute on function public.get_reserved_stock() to anon, authenticated, service_role;
grant execute on function public.create_order(text, text, text, text, jsonb, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_order_public(uuid) to anon, authenticated, service_role;
grant execute on function public.track_orders_by_document(text) to anon, authenticated, service_role;
-- mark_order_paid además verifica adentro que sea un administrador o el servidor
grant execute on function public.mark_order_paid(uuid, numeric) to authenticated, service_role;

-- Aviso a la API para que tome las columnas y funciones nuevas
notify pgrst, 'reload schema';
