-- ============================================================================
-- 014 · TRÁFICO DETALLADO (todo lo que hace el visitante)
-- Suma eventos a los de 013 y un dato corto por evento ("label": qué buscó, qué talle,
-- qué medio de pago, por qué falló el pedido, el número de pedido...). Sigue siendo anónimo.
--   Navegar:   page_view · search · category_filter · sort_change · banner_click
--   Producto:  product_view · variant_select · add_to_cart · remove_from_cart · favorite_add · share_click
--   Comprar:   checkout_start · payment_select · checkout_confirm · order_placed · order_error · mp_redirect
--   Contacto:  whatsapp_click · login · signup
-- El resumen cruza los pedidos con la tabla de pedidos: sabe cuáles se pagaron y cuáles no.
--
-- Requiere 013. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

alter table public.analytics_events add column if not exists label text;

alter table public.analytics_events drop constraint if exists analytics_events_type_check;
alter table public.analytics_events add constraint analytics_events_type_check check (type in (
  'page_view', 'search', 'category_filter', 'sort_change', 'banner_click',
  'product_view', 'variant_select', 'add_to_cart', 'remove_from_cart', 'favorite_add', 'share_click',
  'checkout_start', 'payment_select', 'checkout_confirm', 'order_placed', 'order_error', 'mp_redirect',
  'whatsapp_click', 'login', 'signup'
));

create index if not exists analytics_events_type on public.analytics_events (store_id, type, created_at);

-- ── Registrar un evento (ahora con su dato corto) ────────────────────────────
drop function if exists public.track_event(uuid, text, text, text, uuid, text, text);
create or replace function public.track_event(
  p_store_id uuid,
  p_session text,
  p_type text,
  p_path text default null,
  p_product_id uuid default null,
  p_referrer text default null,
  p_device text default null,
  p_label text default null
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
  if p_store_id is null
     or p_type is null or p_type not in (
       'page_view', 'search', 'category_filter', 'sort_change', 'banner_click',
       'product_view', 'variant_select', 'add_to_cart', 'remove_from_cart', 'favorite_add', 'share_click',
       'checkout_start', 'payment_select', 'checkout_confirm', 'order_placed', 'order_error', 'mp_redirect',
       'whatsapp_click', 'login', 'signup')
     or coalesce(length(p_session), 0) not between 8 and 64 then
    return;
  end if;
  if not exists (select 1 from public.stores s where s.id = p_store_id and s.status = 'active') then
    return;
  end if;
  if v_product is not null and not exists (select 1 from public.products p where p.id = v_product and p.store_id = p_store_id) then
    v_product := null;
  end if;
  -- Límite por visita: 600 eventos por hora (ahora se registran más cosas)
  select count(*) into v_recent
  from public.analytics_events e
  where e.session_id = p_session and e.created_at > now() - interval '1 hour';
  if v_recent >= 600 then
    return;
  end if;

  insert into public.analytics_events (store_id, session_id, type, path, product_id, referrer, device, label)
  values (
    p_store_id, p_session, p_type,
    left(nullif(trim(p_path), ''), 200),
    v_product,
    left(lower(nullif(trim(p_referrer), '')), 100),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device end,
    left(nullif(trim(p_label), ''), 80)
  );
end;
$$;

-- ── El resumen completo (uso interno; lo llama analytics_summary de 013) ─────
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
  bounds as (
    select ((today - (days - 1))::timestamp at time zone 'America/Argentina/Buenos_Aires') as since from params
  ),
  ev as (
    select e.*, (e.created_at at time zone 'America/Argentina/Buenos_Aires') as local_time
    from public.analytics_events e, bounds
    where e.created_at >= bounds.since
      and (p_store_id is null or e.store_id = p_store_id)
  ),
  days as (
    select (params.today - g)::date as day from params, generate_series(0, (select days from params) - 1) g
  ),
  -- Cada visita: de dónde, desde qué aparato, cuánto duró y hasta dónde llegó
  sess as (
    select session_id,
           max(referrer) as referrer, max(device) as device,
           min(created_at) as started, max(created_at) as ended,
           count(*) as events,
           count(*) filter (where type = 'page_view') as pages,
           bool_or(type = 'product_view') as viewed,
           bool_or(type = 'add_to_cart') as added,
           bool_or(type = 'checkout_start') as checkout,
           bool_or(type = 'checkout_confirm') as confirmed,
           bool_or(type = 'order_placed') as ordered,
           bool_or(type = 'order_error') as failed
    from ev group by session_id
  ),
  -- Pedidos reales del período (para saber cuáles se pagaron)
  ord as (
    select o.id, o.store_id, o.status, o.total, o.payment_method, o.items, o.created_at,
           split_part(lower(coalesce(o.status, '')), ' ', 1) in ('pagado', 'preparando', 'enviado', 'despachado', 'entregado') as paid,
           split_part(lower(coalesce(o.status, '')), ' ', 1) in ('reservado', 'pendiente') as waiting
    from public.orders o, bounds
    where o.created_at >= bounds.since
      and (p_store_id is null or o.store_id = p_store_id)
  ),
  paid_sessions as (
    select count(distinct e.session_id) as n
    from ev e join ord o on o.id::text = e.label and o.paid
    where e.type = 'order_placed'
  ),
  prod_ev as (
    select product_id,
           count(*) filter (where type = 'product_view') as views,
           count(distinct session_id) filter (where type = 'product_view') as viewers,
           count(*) filter (where type = 'add_to_cart') as adds,
           count(*) filter (where type = 'remove_from_cart') as removes,
           count(*) filter (where type = 'favorite_add') as favorites,
           count(*) filter (where type = 'share_click') as shares,
           count(*) filter (where type = 'product_view' and label = 'agotado') as sold_out_views
    from ev where product_id is not null group by product_id
  ),
  -- Agregados al carrito en visitas que no terminaron en pedido
  prod_abandoned as (
    select e.product_id, count(*) as n
    from ev e join sess s using (session_id)
    where e.type = 'add_to_cart' and e.product_id is not null and not s.ordered
    group by e.product_id
  ),
  prod_orders as (
    select (i ->> 'id')::uuid as product_id,
           sum((i ->> 'quantity')::integer) as units_ordered,
           coalesce(sum((i ->> 'quantity')::integer) filter (where o.paid), 0) as units_paid,
           coalesce(sum(coalesce((i ->> 'unit_price')::numeric, (i ->> 'price')::numeric, 0) * (i ->> 'quantity')::integer) filter (where o.paid), 0) as revenue
    from ord o cross join lateral jsonb_array_elements(o.items::jsonb) as i
    where (i ->> 'id') ~ '^[0-9a-f-]{36}$'
    group by 1
  ),
  prod as (
    select coalesce(pe.product_id, po.product_id) as id,
           coalesce(pe.views, 0) as views, coalesce(pe.viewers, 0) as viewers,
           coalesce(pe.adds, 0) as adds, coalesce(pe.removes, 0) as removes,
           coalesce(pe.favorites, 0) as favorites, coalesce(pe.shares, 0) as shares,
           coalesce(pe.sold_out_views, 0) as sold_out_views,
           coalesce(pa.n, 0) as abandoned,
           coalesce(po.units_ordered, 0) as units_ordered, coalesce(po.units_paid, 0) as units_paid,
           coalesce(po.revenue, 0) as revenue
    from prod_ev pe
    full join prod_orders po on po.product_id = pe.product_id
    left join prod_abandoned pa on pa.product_id = coalesce(pe.product_id, po.product_id)
  ),
  labels as (
    select type, label, count(*) as n
    from ev
    where label is not null and type in ('search', 'category_filter', 'sort_change', 'payment_select', 'order_error', 'whatsapp_click', 'variant_select', 'login', 'signup', 'banner_click', 'checkout_confirm')
    group by 1, 2
  )
  select jsonb_build_object(
    'days', (select days from params),
    -- Cuántas veces pasó cada cosa
    'events', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (select type, count(*) as n from ev group by type) t),
    'totals', (
      select jsonb_build_object(
        'visits', count(*),
        'pageViews', coalesce(sum(pages), 0),
        'pagesPerVisit', round(coalesce(avg(pages), 0)::numeric, 2),
        -- Se fueron sin mirar nada: una sola página y ningún producto
        'bounceRate', round(coalesce(avg(case when pages <= 1 and not viewed then 1 else 0 end), 0)::numeric, 4),
        'avgSeconds', round(coalesce(avg(extract(epoch from ended - started)) filter (where events > 1), 0)::numeric),
        'abandonedCarts', count(*) filter (where added and not checkout),
        'abandonedCheckouts', count(*) filter (where checkout and not confirmed and not ordered),
        'failedConfirms', count(*) filter (where confirmed and not ordered)
      ) from sess
    ),
    -- Embudo completo: visitas que llegaron a cada paso
    'funnel', (
      select jsonb_build_object(
        'visits', count(*),
        'viewedProduct', count(*) filter (where viewed),
        'addedToCart', count(*) filter (where added),
        'startedCheckout', count(*) filter (where checkout),
        'confirmed', count(*) filter (where confirmed),
        'ordered', count(*) filter (where ordered),
        'paid', (select n from paid_sessions)
      ) from sess
    ),
    'orders', (
      select jsonb_build_object(
        'placed', count(*),
        'paid', count(*) filter (where paid),
        'waiting', count(*) filter (where waiting),
        'canceled', count(*) filter (where not paid and not waiting),
        'revenue', coalesce(sum(total) filter (where paid), 0),
        'avgTicket', round(coalesce(avg(total) filter (where paid), 0)::numeric),
        'byMethod', (
          select coalesce(jsonb_agg(jsonb_build_object('method', m.method, 'placed', m.placed, 'paid', m.paid) order by m.placed desc), '[]'::jsonb)
          from (select coalesce(payment_method, 'Otro') as method, count(*) as placed, count(*) filter (where paid) as paid from ord group by 1) m
        )
      ) from ord
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', d.day, 'visits', coalesce(x.visits, 0), 'pageViews', coalesce(x.page_views, 0),
               'carts', coalesce(x.carts, 0), 'orders', coalesce(x.orders, 0)) order by d.day), '[]'::jsonb)
      from days d
      left join (
        select local_time::date as day,
               count(distinct session_id) as visits,
               count(*) filter (where type = 'page_view') as page_views,
               count(distinct session_id) filter (where type = 'add_to_cart') as carts,
               count(distinct session_id) filter (where type = 'order_placed') as orders
        from ev group by 1
      ) x on x.day = d.day
    ),
    -- Mapa de calor: visitas por día de la semana (1 = lunes) y hora
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', t.dow, 'hour', t.hour, 'visits', t.visits)), '[]'::jsonb)
      from (
        select extract(isodow from local_time)::integer as dow, extract(hour from local_time)::integer as hour,
               count(distinct session_id) as visits
        from ev group by 1, 2
      ) t
    ),
    -- Todos los productos con movimiento, con sus números
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pr.id, 'name', coalesce(p.name, 'Producto borrado'), 'store', s.name,
               'price', p.price, 'stock', p.stock, 'active', p.is_active,
               'views', pr.views, 'viewers', pr.viewers, 'addToCart', pr.adds, 'removes', pr.removes,
               'favorites', pr.favorites, 'shares', pr.shares, 'soldOutViews', pr.sold_out_views,
               'abandoned', pr.abandoned, 'unitsOrdered', pr.units_ordered, 'unitsPaid', pr.units_paid,
               'revenue', pr.revenue) order by pr.views desc, pr.units_ordered desc), '[]'::jsonb)
      from (select * from prod order by views desc, units_ordered desc limit 200) pr
      left join public.products p on p.id = pr.id
      left join public.stores s on s.id = p.store_id
    ),
    'topPages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.section, 'views', t.views) order by t.views desc), '[]'::jsonb)
      from (
        select case when path like '/producto/%' then '/producto' else coalesce(path, '/') end as section, count(*) as views
        from ev where type = 'page_view' group by 1 order by 2 desc limit 10
      ) t
    ),
    -- Lo más frecuente de cada tipo: búsquedas, categorías, medios de pago, errores...
    'labels', (
      select coalesce(jsonb_object_agg(type, items), '{}'::jsonb)
      from (
        select type, jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc) as items
        from (select type, label, n, row_number() over (partition by type order by n desc) as rk from labels) r
        where rk <= 12
        group by type
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', t.source, 'visits', t.visits, 'orders', t.orders) order by t.visits desc), '[]'::jsonb)
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
               count(*) as visits,
               count(*) filter (where ordered) as orders
        from sess group by 1
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', t.device, 'visits', t.visits, 'orders', t.orders) order by t.visits desc), '[]'::jsonb)
      from (select coalesce(device, 'desktop') as device, count(*) as visits, count(*) filter (where ordered) as orders from sess group by 1) t
    ),
    'byStore', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.store_id, 'name', s.name, 'slug', s.slug, 'visits', t.visits,
               'productViews', t.product_views, 'addToCart', t.carts, 'orders', t.orders,
               'paid', coalesce(op.paid, 0), 'revenue', coalesce(op.revenue, 0)) order by t.visits desc), '[]'::jsonb)
      from (
        select store_id, count(distinct session_id) as visits,
               count(*) filter (where type = 'product_view') as product_views,
               count(distinct session_id) filter (where type = 'add_to_cart') as carts,
               count(distinct session_id) filter (where type = 'order_placed') as orders
        from ev group by store_id order by 2 desc limit 25
      ) t
      join public.stores s on s.id = t.store_id
      left join (select store_id, count(*) filter (where paid) as paid, coalesce(sum(total) filter (where paid), 0) as revenue from ord group by 1) op on op.store_id = t.store_id
      where p_store_id is null
    ),
    'stores', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) order by s.name), '[]'::jsonb)
      from public.stores s
      where p_store_id is null
    )
  );
$$;

-- ── En vivo: lo que pasa ahora (se consulta cada pocos segundos) ──────────────
-- Siempre devuelve un resumen chico, haya poco o mucho tráfico: cuántos navegan ahora,
-- los últimos 30 minutos minuto a minuto y los 25 eventos más recientes.
-- Mismos permisos que el resumen: el superadmin todo, cada dueño su tienda.
create or replace function public.analytics_live(p_store_id uuid default null)
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

  return (
    with ev as (
      select e.*
      from public.analytics_events e
      where e.created_at > now() - interval '30 minutes'
        and (p_store_id is null or e.store_id = p_store_id)
    ),
    recent5 as (select * from ev where created_at > now() - interval '5 minutes')
    select jsonb_build_object(
      'serverTime', now(),
      'activeNow', (select count(distinct session_id) from recent5),
      'withCart', (select count(distinct session_id) from recent5 where type in ('add_to_cart', 'checkout_start', 'payment_select', 'checkout_confirm')),
      'inCheckout', (select count(distinct session_id) from recent5 where type in ('checkout_start', 'payment_select', 'checkout_confirm')),
      'ordersLast30', (select count(*) from ev where type = 'order_placed'),
      'perMinute', (
        select coalesce(jsonb_agg(jsonb_build_object('minutesAgo', m.ago, 'visits', coalesce(x.visits, 0)) order by m.ago desc), '[]'::jsonb)
        from generate_series(0, 29) as m(ago)
        left join (
          select floor(extract(epoch from now() - created_at) / 60)::integer as ago, count(distinct session_id) as visits
          from ev group by 1
        ) x on x.ago = m.ago
      ),
      'recent', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'at', r.created_at, 'type', r.type, 'device', r.device, 'store', r.store, 'product', r.product,
                 -- El número de pedido no se muestra
                 'label', case when r.type = 'order_placed' then null else r.label end,
                 'path', r.path) order by r.created_at desc), '[]'::jsonb)
        from (
          select e.created_at, e.type, e.device, e.label, e.path, s.name as store, p.name as product
          from ev e
          left join public.stores s on s.id = e.store_id
          left join public.products p on p.id = e.product_id
          order by e.created_at desc
          limit 25
        ) r
      )
    )
  );
end;
$$;

revoke all on function public.analytics_live(uuid) from public, anon;
grant execute on function public.analytics_live(uuid) to authenticated, service_role;

revoke all on function public.track_event(uuid, text, text, text, uuid, text, text, text) from public;
grant execute on function public.track_event(uuid, text, text, text, uuid, text, text, text) to anon, authenticated, service_role;
revoke all on function public.analytics_report(integer, uuid) from public, anon, authenticated;
grant execute on function public.analytics_report(integer, uuid) to service_role;

notify pgrst, 'reload schema';
