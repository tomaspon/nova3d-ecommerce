-- ============================================================================
-- 006 · ALTA DE TIENDAS POR AUTOSERVICIO
-- Los emprendedores crean su tienda solos desde la página oficial. La tienda queda
-- lista para armarla, pero NO recibe pedidos hasta que la plataforma habilita las
-- ventas (después de verificar al titular). Así un estafador no puede cobrar apenas
-- se registra.
--
-- Las tiendas que ya existían quedan con las ventas habilitadas: no cambia nada para ellas.
-- Requiere 003. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

alter table public.stores
  add column if not exists sales_enabled boolean not null default true,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists signup_ip text,
  add column if not exists activation_requested_at timestamptz;

create index if not exists stores_created_by_idx on public.stores (created_by);

-- Los datos del alta (quién la creó, IP, consentimiento) son privados: el público solo
-- lee los datos de la tienda. El panel de plataforma los ve desde el servidor.
revoke select on public.stores from anon, authenticated;
grant select (id, slug, name, status, custom_domain, template, branding, sales_enabled, created_at)
  on public.stores to anon, authenticated;

-- Qué tienda mostrar: ahora también dice si puede vender
create or replace function public.get_store_by_host(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with h as (
    select regexp_replace(lower(split_part(coalesce(p_host, ''), ':', 1)), '^www\.', '') as host
  )
  select to_jsonb(x)
  from (
    select s.id, s.slug, s.name, s.status, s.template, s.branding, s.sales_enabled
    from public.stores s, h
    where lower(s.custom_domain) = h.host
       or s.slug = split_part(h.host, '.', 1)
    order by (lower(s.custom_domain) = h.host) desc nulls last
    limit 1
  ) x;
$$;

create or replace function public.get_store_by_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(x)
  from (
    select s.id, s.slug, s.name, s.status, s.template, s.branding, s.sales_enabled
    from public.stores s
    where s.slug = lower(trim(p_slug))
  ) x;
$$;

-- Crear una orden: igual que en 003, pero la tienda tiene que tener las ventas habilitadas
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

  -- Con sesión iniciada, la orden queda con el email de la cuenta
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
    select e.value from jsonb_array_elements(p_items) as e order by e.value ->> 'id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Cantidad inválida.';
    end if;

    -- Solo productos activos de esta tienda
    select * into v_product
    from public.products p
    where p.id = (v_item ->> 'id')::uuid and p.is_active and p.store_id = v_store
    for update;

    if not found then
      raise exception 'Un producto del carrito ya no está disponible.';
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
      and (i ->> 'id')::uuid = v_product.id;

    -- Disponible = stock físico menos lo que otros clientes tienen reservado
    if v_product.stock - v_reserved < v_qty then
      raise exception 'No hay suficiente stock de "%".', v_product.name;
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

revoke all on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) from public;
grant execute on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
