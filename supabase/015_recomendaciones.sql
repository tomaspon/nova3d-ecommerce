-- 015 · Recomendaciones con el tráfico: "Quienes vieron esto también miraron".
-- Usa las visitas anónimas de 013/014: si en una misma visita alguien miró (o agregó al carrito)
-- este producto y otro, esos dos van juntos. Solo devuelve ids de productos a la venta de esa tienda,
-- y solo los que se miraron juntos en al menos 2 visitas distintas (nunca el recorrido de una sola persona).
-- Se puede correr más de una vez.

-- Para encontrar rápido las visitas que miraron un producto
create index if not exists analytics_events_product
  on public.analytics_events (product_id, created_at)
  where product_id is not null;

create or replace function public.products_also_viewed(p_store_id uuid, p_product_id uuid, p_limit integer default 4)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with visits as (
    -- Las visitas (de los últimos 90 días) que miraron este producto en esta tienda
    select distinct e.session_id
    from public.analytics_events e
    where e.product_id = p_product_id
      and e.store_id = p_store_id
      and e.type in ('product_view', 'add_to_cart')
      and e.created_at > now() - interval '90 days'
    limit 2000
  ),
  together as (
    select e.product_id,
           count(distinct e.session_id) as sessions,
           count(*) filter (where e.type = 'add_to_cart') as carts
    from public.analytics_events e
    join visits v on v.session_id = e.session_id
    where e.store_id = p_store_id
      and e.product_id is not null
      and e.product_id <> p_product_id
      and e.type in ('product_view', 'add_to_cart')
      and e.created_at > now() - interval '90 days'
    group by e.product_id
    having count(distinct e.session_id) >= 2
  )
  select coalesce(array_agg(t.product_id order by t.sessions desc, t.carts desc), '{}')
  from (
    select t.product_id, t.sessions, t.carts
    from together t
    join public.products p on p.id = t.product_id and p.store_id = p_store_id and p.is_active
    order by t.sessions desc, t.carts desc
    limit least(greatest(coalesce(p_limit, 4), 1), 12)
  ) t;
$$;

revoke all on function public.products_also_viewed(uuid, uuid, integer) from public;
grant execute on function public.products_also_viewed(uuid, uuid, integer) to anon, authenticated, service_role;
