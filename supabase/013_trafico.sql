-- ============================================================================
-- 013 · TRÁFICO E INTERACCIONES (anónimo)
-- Cada tienda registra lo que hacen sus visitantes, SIN datos personales: ni IP, ni email,
-- ni nombre. Cada visita lleva solo una marca al azar que dura lo que dura la pestaña.
--   page_view       entró a una página        product_view   vio un producto
--   add_to_cart     agregó al carrito         checkout_start empezó a comprar
--   order_placed    hizo el pedido
-- Lo ve el superadmin (todas las tiendas) y cada dueño (solo la suya). Los visitantes solo
-- pueden registrar eventos, nunca leerlos, y con un límite por visita para que nadie llene la base.
--
-- Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores (id) on delete cascade,
  session_id text not null,
  type text not null check (type in ('page_view', 'product_view', 'add_to_cart', 'checkout_start', 'order_placed')),
  path text,
  product_id uuid,
  referrer text,
  device text check (device in ('mobile', 'tablet', 'desktop'))
);

create index if not exists analytics_events_store_time on public.analytics_events (store_id, created_at);
create index if not exists analytics_events_time on public.analytics_events (created_at);
create index if not exists analytics_events_session on public.analytics_events (session_id, created_at);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- ── Registrar un evento (lo llama la tienda, sin sesión) ─────────────────────
create or replace function public.track_event(
  p_store_id uuid,
  p_session text,
  p_type text,
  p_path text default null,
  p_product_id uuid default null,
  p_referrer text default null,
  p_device text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
  v_product uuid := p_product_id;
begin
  -- Datos inválidos: se ignoran en silencio (el visitante nunca ve un error por esto)
  if p_store_id is null
     or p_type is null or p_type not in ('page_view', 'product_view', 'add_to_cart', 'checkout_start', 'order_placed')
     or coalesce(length(p_session), 0) not between 8 and 64 then
    return;
  end if;
  if not exists (select 1 from public.stores s where s.id = p_store_id and s.status = 'active') then
    return;
  end if;
  -- El producto tiene que ser de esa tienda
  if v_product is not null and not exists (select 1 from public.products p where p.id = v_product and p.store_id = p_store_id) then
    v_product := null;
  end if;
  -- Límite por visita: 300 eventos por hora
  select count(*) into v_recent
  from public.analytics_events e
  where e.session_id = p_session and e.created_at > now() - interval '1 hour';
  if v_recent >= 300 then
    return;
  end if;

  insert into public.analytics_events (store_id, session_id, type, path, product_id, referrer, device)
  values (
    p_store_id, p_session, p_type,
    left(nullif(trim(p_path), ''), 200),
    v_product,
    left(lower(nullif(trim(p_referrer), '')), 100),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device end
  );
end;
$$;

-- ── Resumen (uso interno: lo llama analytics_summary, que controla quién mira) ──
-- p_days: período (1 a 365 días, hasta hoy). p_store_id: una tienda, o null = todas.
create or replace function public.analytics_report(p_days integer default 30, p_store_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as days,
           (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  ),
  ev as (
    select e.*, (e.created_at at time zone 'America/Argentina/Buenos_Aires')::date as day
    from public.analytics_events e, params
    where e.created_at >= ((params.today - (params.days - 1))::timestamp at time zone 'America/Argentina/Buenos_Aires')
      and (p_store_id is null or e.store_id = p_store_id)
  ),
  days as (
    select (params.today - g)::date as day from params, generate_series(0, (select days from params) - 1) g
  ),
  -- Por visita: de dónde llegó y desde qué aparato (el primer dato que mandó)
  sessions as (
    select session_id, max(referrer) as referrer, max(device) as device, min(store_id::text)::uuid as store_id
    from ev group by session_id
  )
  select jsonb_build_object(
    'days', (select days from params),
    'totals', (
      select jsonb_build_object(
        'visits', count(distinct session_id),
        'pageViews', count(*) filter (where type = 'page_view'),
        'productViews', count(*) filter (where type = 'product_view'),
        'addToCart', count(*) filter (where type = 'add_to_cart'),
        'checkouts', count(*) filter (where type = 'checkout_start'),
        'orders', count(*) filter (where type = 'order_placed')
      ) from ev
    ),
    -- Embudo: cuántas visitas llegaron a cada paso
    'funnel', (
      select jsonb_build_object(
        'visits', count(distinct session_id),
        'viewedProduct', count(distinct session_id) filter (where type = 'product_view'),
        'addedToCart', count(distinct session_id) filter (where type = 'add_to_cart'),
        'startedCheckout', count(distinct session_id) filter (where type = 'checkout_start'),
        'ordered', count(distinct session_id) filter (where type = 'order_placed')
      ) from ev
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'visits', coalesce(x.visits, 0), 'pageViews', coalesce(x.page_views, 0)) order by d.day), '[]'::jsonb)
      from days d
      left join (
        select day, count(distinct session_id) as visits, count(*) filter (where type = 'page_view') as page_views
        from ev group by day
      ) x on x.day = d.day
    ),
    'topProducts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.product_id, 'name', coalesce(p.name, 'Producto borrado'), 'store', s.name,
               'views', t.views, 'addToCart', t.adds) order by t.views desc, t.adds desc), '[]'::jsonb)
      from (
        select product_id, store_id,
               count(*) filter (where type = 'product_view') as views,
               count(*) filter (where type = 'add_to_cart') as adds
        from ev where product_id is not null
        group by product_id, store_id
        order by 3 desc, 4 desc
        limit 10
      ) t
      left join public.products p on p.id = t.product_id
      left join public.stores s on s.id = t.store_id
    ),
    -- Secciones: las fichas de producto van juntas
    'topPages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.section, 'views', t.views) order by t.views desc), '[]'::jsonb)
      from (
        select case when path like '/producto/%' then '/producto' else coalesce(path, '/') end as section, count(*) as views
        from ev where type = 'page_view'
        group by 1 order by 2 desc limit 8
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', t.source, 'visits', t.visits) order by t.visits desc), '[]'::jsonb)
      from (
        select case
                 when referrer is null then 'Directo'
                 when referrer ~ 'instagram' then 'Instagram'
                 when referrer ~ '(facebook|fb\.)' then 'Facebook'
                 when referrer ~ '(whatsapp|wa\.me)' then 'WhatsApp'
                 when referrer ~ 'google' then 'Google'
                 when referrer ~ 'tiktok' then 'TikTok'
                 else 'Otros sitios'
               end as source,
               count(*) as visits
        from sessions group by 1
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', t.device, 'visits', t.visits) order by t.visits desc), '[]'::jsonb)
      from (select coalesce(device, 'desktop') as device, count(*) as visits from sessions group by 1) t
    ),
    -- Comparación entre tiendas: solo cuando se mira toda la plataforma
    'byStore', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.store_id, 'name', s.name, 'slug', s.slug, 'visits', t.visits,
               'productViews', t.product_views, 'addToCart', t.carts, 'orders', t.orders) order by t.visits desc), '[]'::jsonb)
      from (
        select store_id, count(distinct session_id) as visits,
               count(*) filter (where type = 'product_view') as product_views,
               count(distinct session_id) filter (where type = 'add_to_cart') as carts,
               count(distinct session_id) filter (where type = 'order_placed') as orders
        from ev group by store_id order by 2 desc limit 25
      ) t
      join public.stores s on s.id = t.store_id
      where p_store_id is null
    ),
    'stores', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) order by s.name), '[]'::jsonb)
      from public.stores s
      where p_store_id is null
    )
  );
$$;

-- ── Lo que se puede mirar ────────────────────────────────────────────────────
-- Toda la plataforma: solo el superadmin (verificado en dos pasos, ver 009).
-- Una tienda: el superadmin o quien la administra. Nadie más.
create or replace function public.analytics_summary(p_days integer default 30, p_store_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_trusted_caller()
    or (p_store_id is null and public.is_admin())
    or (p_store_id is not null and public.is_store_admin(p_store_id))
  ) then
    raise exception 'No autorizado.';
  end if;
  return public.analytics_report(p_days, p_store_id);
end;
$$;

revoke all on function public.track_event(uuid, text, text, text, uuid, text, text) from public;
grant execute on function public.track_event(uuid, text, text, text, uuid, text, text) to anon, authenticated, service_role;
revoke all on function public.analytics_report(integer, uuid) from public, anon, authenticated;
grant execute on function public.analytics_report(integer, uuid) to service_role;
revoke all on function public.analytics_summary(integer, uuid) from public, anon;
grant execute on function public.analytics_summary(integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
