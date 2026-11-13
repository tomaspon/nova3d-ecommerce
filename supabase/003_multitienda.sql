-- ============================================================================
-- 003 · MULTI-TIENDA
-- Convierte la base en una plataforma: cada producto, orden, ajuste de stock,
-- favorito y configuración pertenece a una tienda (store_id). Lo que ya existe
-- pasa a ser de la tienda MINIMAL.
--
-- Compatible con la versión publicada: las columnas nuevas tienen como valor por
-- defecto la tienda MINIMAL y las funciones aceptan los llamados de siempre (sin
-- indicar tienda), así que se puede correr ANTES de publicar el código nuevo.
--
-- Quién administra qué:
--   · Administrador de plataforma: app_metadata.role = 'admin' (igual que hoy).
--     Ve y edita todas las tiendas.
--   · Dueño de tienda: fila en store_members. Ve y edita solo su tienda.
--
-- Requiere 001 y 002 aplicados. Se puede ejecutar más de una vez.
-- IMPORTANTE: después de este archivo no se vuelven a correr 001 ni 002 (reemplazan
-- funciones y permisos por las versiones de tienda única).
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

-- ── Tiendas ─────────────────────────────────────────────────────────────────

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  -- Subdominio: velas-luna.<dominio de la plataforma>
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- Dominio propio opcional, sin "www." (ej: velasluna.com.ar)
  custom_domain text unique,
  -- Plantilla de rubro elegida al crearla (ropa, velas, accesorios...)
  template text not null default 'ropa',
  -- Marca: logo, colores, textos de portada, contacto (se completa en la etapa 2)
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_members_user_id_idx on public.store_members (user_id);

-- La primera tienda tiene un id fijo: es el valor por defecto de store_id mientras
-- el código publicado todavía no indica la tienda en cada operación.
insert into public.stores (id, slug, name, template)
values ('00000000-0000-0000-0000-000000000001', 'minimal', 'MINIMAL.', 'ropa')
on conflict (id) do nothing;

-- ── store_id en cada tabla ──────────────────────────────────────────────────
-- Las filas existentes quedan en MINIMAL al agregar la columna.

alter table public.products
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.stores (id);
alter table public.orders
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.stores (id);
alter table public.inventory_logs
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.stores (id);
alter table public.favorites
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.stores (id);
alter table public.store_settings
  add column if not exists store_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.stores (id);

create index if not exists products_store_id_idx on public.products (store_id);
create index if not exists orders_store_id_idx on public.orders (store_id);
create index if not exists inventory_logs_store_id_idx on public.inventory_logs (store_id);
create index if not exists favorites_store_id_idx on public.favorites (store_id);
-- Una configuración por tienda
create unique index if not exists store_settings_store_id_key on public.store_settings (store_id);

-- store_settings tenía una sola fila (id = 1): las tiendas nuevas necesitan que el id se genere solo
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings' and column_name = 'id'
      and column_default is null and is_identity = 'NO'
  ) then
    create sequence if not exists public.store_settings_id_seq owned by public.store_settings.id;
    perform setval('public.store_settings_id_seq', greatest((select max(id) from public.store_settings), 1));
    alter table public.store_settings alter column id set default nextval('public.store_settings_id_seq');
  end if;
end $$;

-- ── Quién administra cada tienda ────────────────────────────────────────────

-- Administrador de la plataforma o miembro de esa tienda.
-- security definer: consulta store_members sin depender de sus permisos.
create or replace function public.is_store_admin(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid()
  );
$$;

-- Tienda dueña de un archivo subido: la primera carpeta de la ruta ("<store_id>/foto.jpg")
create or replace function public.path_store_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- ── Qué tienda mostrar según el dominio ─────────────────────────────────────
-- Primero el dominio propio; si no, el subdominio como slug (velas-luna.plataforma.com).
-- Devuelve null si ninguna coincide: el sitio usa entonces su tienda por defecto.
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
    select s.id, s.slug, s.name, s.status, s.template, s.branding
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
    select s.id, s.slug, s.name, s.status, s.template, s.branding
    from public.stores s
    where s.slug = lower(trim(p_slug))
  ) x;
$$;

-- Tiendas que puede administrar quien llama (todas, si es administrador de plataforma)
create or replace function public.my_stores()
returns table (id uuid, slug text, name text, status text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.status,
         case when public.is_admin() then 'platform' else m.role end
  from public.stores s
  left join public.store_members m on m.store_id = s.id and m.user_id = auth.uid()
  where public.is_admin() or m.user_id is not null
  order by s.created_at;
$$;

-- ── Funciones de la tienda, ahora por tienda ────────────────────────────────
-- Se reemplazan las versiones de 001. p_store_id es opcional: sin él se usa MINIMAL,
-- que es lo que hace el código publicado hasta que se actualice.

drop function if exists public.get_reserved_stock();
create or replace function public.get_reserved_stock(p_store_id uuid default null)
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
    and (p_store_id is null or o.store_id = p_store_id)
    and (
      (coalesce(o.payment_method, '') <> 'Transferencia' and o.created_at > now() - interval '10 minutes')
      or (o.payment_method = 'Transferencia' and o.created_at > now() - interval '48 hours')
    )
  group by 1;
$$;

drop function if exists public.create_order(text, text, text, text, jsonb, text, jsonb);
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
  if not exists (select 1 from public.stores s where s.id = v_store and s.status = 'active') then
    raise exception 'La tienda no está disponible.';
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

-- Solo el servidor o quien administra la tienda de esa orden
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
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if not (public.is_trusted_caller() or public.is_store_admin(v_order.store_id)) then
    raise exception 'No autorizado.';
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
    where p.id = (v_item ->> 'id')::uuid and p.store_id = v_order.store_id
    returning p.stock into v_stock;

    if found then
      insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note, store_id)
      values (
        (v_item ->> 'id')::uuid,
        -(v_item ->> 'quantity')::integer,
        v_stock,
        'Venta',
        'Orden #' || left(v_order.id::text, 8),
        v_order.store_id
      );
    end if;
  end loop;

  update public.orders o set status = 'pagado' where o.id = p_order_id;
  return 'pagado';
end;
$$;

create or replace function public.adjust_stock(p_product_id uuid, p_delta integer, p_reason text, p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before numeric;
  v_after numeric;
  v_store uuid;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'La cantidad del ajuste no puede ser cero.';
  end if;

  select p.stock, p.store_id into v_before, v_store from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  if not public.is_store_admin(v_store) then
    raise exception 'No autorizado.';
  end if;

  v_after := greatest(v_before + p_delta, 0);
  update public.products p set stock = v_after where p.id = p_product_id;

  insert into public.inventory_logs (product_id, change_amount, stock_after, reason, note, store_id)
  values (p_product_id, v_after - v_before, v_after, coalesce(nullif(trim(p_reason), ''), 'Ajuste Manual'), coalesce(p_note, ''), v_store);

  return v_after;
end;
$$;

drop function if exists public.track_orders_by_document(text);
create or replace function public.track_orders_by_document(p_document text, p_store_id uuid default null)
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
      and o.store_id = coalesce(p_store_id, '00000000-0000-0000-0000-000000000001'::uuid)
      and o.status not ilike 'cancelado%'
    order by o.created_at desc
    limit 20
  ) t;
$$;

-- ── Seguridad por tienda ────────────────────────────────────────────────────

alter table public.stores enable row level security;
alter table public.store_members enable row level security;

-- Se parte de cero en todas las tablas de la tienda
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('stores', 'store_members', 'products', 'orders', 'inventory_logs', 'store_settings', 'favorites')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Tiendas: los datos públicos (nombre, marca, dominio) los lee cualquiera.
-- El dueño edita nombre, plantilla y marca; estado, slug y dominio solo la plataforma.
create policy "tiendas: lectura publica" on public.stores
  for select using (true);
create policy "tiendas: edicion del dueno" on public.stores
  for update to authenticated using (public.is_store_admin(id)) with check (public.is_store_admin(id));

-- Miembros: cada uno ve sus tiendas; quien administra una tienda ve a su equipo.
-- Altas y bajas solo desde el servidor o la plataforma (por ahora, SQL).
create policy "miembros: lectura" on public.store_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_store_admin(store_id));

-- Productos: catálogo público de tiendas activas; cambios solo de quien la administra
create policy "productos: lectura publica" on public.products
  for select using (
    store_id in (select s.id from public.stores s where s.status = 'active')
    or public.is_store_admin(store_id)
  );
create policy "productos: alta" on public.products
  for insert to authenticated with check (public.is_store_admin(store_id));
create policy "productos: edicion" on public.products
  for update to authenticated using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "productos: baja" on public.products
  for delete to authenticated using (public.is_store_admin(store_id));

-- Configuración: lectura pública; cambios de quien administra la tienda
create policy "configuracion: lectura publica" on public.store_settings
  for select using (true);
create policy "configuracion: alta" on public.store_settings
  for insert to authenticated with check (public.is_store_admin(store_id));
create policy "configuracion: edicion" on public.store_settings
  for update to authenticated using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- Órdenes: cada cliente ve las suyas; quien administra la tienda, las de su tienda.
-- No hay política de alta: las órdenes se crean solo con create_order().
create policy "ordenes: lectura" on public.orders
  for select to authenticated
  using (
    public.is_store_admin(store_id)
    or user_id = (select auth.uid())
    or customer_email = (select auth.jwt() ->> 'email')
  );
create policy "ordenes: edicion" on public.orders
  for update to authenticated using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "ordenes: baja" on public.orders
  for delete to authenticated using (public.is_store_admin(store_id));

-- Historial de inventario: quien administra la tienda, y solo sobre productos de esa tienda
create policy "inventario: lectura" on public.inventory_logs
  for select to authenticated using (public.is_store_admin(store_id));
create policy "inventario: alta" on public.inventory_logs
  for insert to authenticated
  with check (
    public.is_store_admin(store_id)
    and exists (select 1 from public.products p where p.id = product_id and p.store_id = inventory_logs.store_id)
  );

-- Favoritos: cada cliente maneja los suyos
create policy "favoritos: propios" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Permisos de tabla ───────────────────────────────────────────────────────
-- Supabase da todos los permisos a las tablas nuevas por defecto: se recortan.
revoke all on public.stores, public.store_members from anon, authenticated;
grant select on public.stores to anon, authenticated;
grant update (name, template, branding) on public.stores to authenticated;
grant select on public.store_members to authenticated;
grant insert on public.store_settings to authenticated;

-- ── Imágenes: cada tienda sube en su carpeta ("<store_id>/...") ─────────────
-- Las imágenes viejas (sin carpeta) solo las maneja el administrador de plataforma.
do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "imagenes: lectura publica" on storage.objects
  for select using (bucket_id in ('images', 'products', 'product-images'));
create policy "imagenes: alta" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('images', 'products', 'product-images') and public.is_store_admin(public.path_store_id(name)));
create policy "imagenes: edicion" on storage.objects
  for update to authenticated
  using (bucket_id in ('images', 'products', 'product-images') and public.is_store_admin(public.path_store_id(name)));
create policy "imagenes: baja" on storage.objects
  for delete to authenticated
  using (bucket_id in ('images', 'products', 'product-images') and public.is_store_admin(public.path_store_id(name)));

-- ── Quién puede ejecutar cada función ───────────────────────────────────────

revoke all on function public.get_reserved_stock(uuid) from public;
revoke all on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) from public;
revoke all on function public.mark_order_paid(uuid, numeric) from public;
revoke all on function public.adjust_stock(uuid, integer, text, text) from public;
revoke all on function public.track_orders_by_document(text, uuid) from public;
revoke all on function public.my_stores() from public;

grant execute on function public.is_store_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.path_store_id(text) to anon, authenticated, service_role;
grant execute on function public.get_store_by_host(text) to anon, authenticated, service_role;
grant execute on function public.get_store_by_slug(text) to anon, authenticated, service_role;
grant execute on function public.get_reserved_stock(uuid) to anon, authenticated, service_role;
grant execute on function public.create_order(text, text, text, text, jsonb, text, jsonb, uuid) to anon, authenticated, service_role;
grant execute on function public.track_orders_by_document(text, uuid) to anon, authenticated, service_role;
grant execute on function public.my_stores() to authenticated;
-- mark_order_paid y adjust_stock además verifican adentro quién las llama
grant execute on function public.mark_order_paid(uuid, numeric) to authenticated, service_role;
grant execute on function public.adjust_stock(uuid, integer, text, text) to authenticated;

notify pgrst, 'reload schema';
