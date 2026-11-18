-- 016 · Privacidad del seguimiento, límites de intentos y registro de errores.
--  1. Seguimiento por DNI: ahora pide además el email de la compra o el número de pedido.
--     Antes alcanzaba con el DNI (números correlativos: se podían probar de a uno).
--     Se borran las dos versiones viejas (la de 001 buscaba en todas las tiendas).
--  2. Límite de intentos por conexión (y por DNI), para el seguimiento y para la API (cobros).
--  3. Registro de errores (del navegador y del servidor) para el superadmin.
-- Se puede correr más de una vez.

-- ── Límite de intentos ──────────────────────────────────────────────────────
create table if not exists public.rate_limit_hits (
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_bucket on public.rate_limit_hits (bucket, created_at);
alter table public.rate_limit_hits enable row level security; -- sin políticas: solo por las funciones

-- La conexión de quien llama (la primera IP que agrega el proxy de Supabase). Nunca se guarda sola:
-- va dentro de la marca del límite, que se borra al día.
create or replace function public.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'sin-ip'
  );
$$;

-- Suma un intento al balde y dice si todavía está dentro del límite
create or replace function public.rate_limit_ok(p_bucket text, p_max integer, p_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if random() < 0.01 then
    delete from public.rate_limit_hits where created_at < now() - interval '1 day';
  end if;
  insert into public.rate_limit_hits (bucket) values (left(p_bucket, 200));
  select count(*) into v_count
  from public.rate_limit_hits
  where bucket = left(p_bucket, 200) and created_at > now() - make_interval(secs => p_seconds);
  return v_count <= p_max;
end;
$$;

-- ── Seguimiento: DNI + (email o número de pedido) ───────────────────────────
drop function if exists public.track_orders_by_document(text);
drop function if exists public.track_orders_by_document(text, uuid);

create or replace function public.track_orders_by_document(p_document text, p_store_id uuid, p_check text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_store uuid := coalesce(p_store_id, '00000000-0000-0000-0000-000000000001'::uuid);
  v_doc text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
  v_check text := lower(trim(coalesce(p_check, '')));
  v_email text;
begin
  if length(v_doc) < 6 or length(v_check) < 6 then
    return '[]'::jsonb;
  end if;
  if not public.rate_limit_ok('seguimiento:' || public.request_ip(), 20, 3600)
     or not public.rate_limit_ok('seguimiento-dni:' || v_store || ':' || v_doc, 10, 3600) then
    raise exception 'Demasiados intentos. Probá de nuevo en un rato.' using errcode = 'P0001';
  end if;

  -- Con el email de la compra, o con el número de pedido (los primeros 8 caracteres, como en el mail)
  if position('@' in v_check) > 0 then
    v_email := v_check;
  else
    select lower(o.customer_email) into v_email
    from public.orders o
    where o.store_id = v_store
      and regexp_replace(coalesce(o.customer_document, ''), '\D', '', 'g') = v_doc
      and left(o.id::text, 8) = left(ltrim(v_check, '#'), 8)
    limit 1;
  end if;
  if v_email is null then
    return '[]'::jsonb;
  end if;

  return (
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
      where o.store_id = v_store
        and regexp_replace(coalesce(o.customer_document, ''), '\D', '', 'g') = v_doc
        and lower(o.customer_email) = v_email
        and o.status not ilike 'cancelado%'
      order by o.created_at desc
      limit 20
    ) t
  );
end;
$$;

-- ── Registro de errores ─────────────────────────────────────────────────────
create table if not exists public.app_errors (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  times integer not null default 1,
  source text not null,            -- 'navegador' o el nombre de la función del servidor
  store_id uuid,
  path text,
  message text not null,
  detail text,
  user_agent text
);
create index if not exists app_errors_last on public.app_errors (last_at desc);
alter table public.app_errors enable row level security; -- sin políticas: solo por las funciones

-- Guarda un error; si el mismo se repite en la última hora, suma una vez más en lugar de otra fila
create or replace function public.app_error_record(p_source text, p_store_id uuid, p_path text, p_message text, p_detail text, p_user_agent text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_message text := left(coalesce(nullif(trim(p_message), ''), 'Error sin mensaje'), 500);
  v_path text := left(p_path, 300);
  v_id bigint;
begin
  if random() < 0.02 then
    delete from public.app_errors where last_at < now() - interval '30 days';
  end if;
  select id into v_id from public.app_errors
  where source = left(p_source, 60) and message = v_message and path is not distinct from v_path
    and store_id is not distinct from p_store_id and last_at > now() - interval '1 hour'
  order by last_at desc limit 1;
  if v_id is not null then
    update public.app_errors set times = times + 1, last_at = now() where id = v_id;
  else
    insert into public.app_errors (source, store_id, path, message, detail, user_agent)
    values (left(p_source, 60), p_store_id, v_path, v_message, left(p_detail, 4000), left(p_user_agent, 300));
  end if;
end;
$$;

-- Desde el navegador (cualquiera): con límite por conexión, sin datos personales
create or replace function public.log_client_error(p_store_id uuid, p_path text, p_message text, p_detail text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.rate_limit_ok('errores:' || public.request_ip(), 30, 3600) then
    return;
  end if;
  perform public.app_error_record('navegador', p_store_id, p_path, p_message, p_detail,
    current_setting('request.headers', true)::json ->> 'user-agent');
end;
$$;

-- Para el superadmin (con verificación en dos pasos, como is_admin)
create or replace function public.recent_errors(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.last_at desc), '[]'::jsonb)
    from (
      select e.id, e.created_at, e.last_at, e.times, e.source, e.path, e.message, e.detail, e.user_agent,
             s.name as store, s.slug
      from public.app_errors e
      left join public.stores s on s.id = e.store_id
      where e.last_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
      order by e.last_at desc
      limit 200
    ) t
  );
end;
$$;

-- ── Datos del dueño de cada tienda (alta por autoservicio) ─────────────────
-- CUIL/CUIT (para verificar identidad y cobrar), WhatsApp y por dónde vende hoy (opcional).
-- Sin políticas: no los lee nadie desde el navegador; solo el servidor (alta y superadmin).
create table if not exists public.store_owner_details (
  store_id uuid primary key references public.stores (id) on delete cascade,
  tax_id text not null,
  whatsapp text not null,
  sales_channels text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.store_owner_details enable row level security;

-- ── Permisos ────────────────────────────────────────────────────────────────
revoke all on function public.request_ip() from public;
revoke all on function public.rate_limit_ok(text, integer, integer) from public, anon, authenticated;
revoke all on function public.track_orders_by_document(text, uuid, text) from public;
revoke all on function public.app_error_record(text, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.log_client_error(uuid, text, text, text) from public;
revoke all on function public.recent_errors(integer) from public, anon;

grant execute on function public.rate_limit_ok(text, integer, integer) to service_role;
grant execute on function public.track_orders_by_document(text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.app_error_record(text, uuid, text, text, text, text) to service_role;
grant execute on function public.log_client_error(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.recent_errors(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
