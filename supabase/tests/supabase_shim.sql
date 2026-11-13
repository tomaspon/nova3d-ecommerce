-- Imitación mínima de Supabase para probar las migraciones en PGlite (PostgreSQL en memoria).
-- Roles, auth.uid()/auth.jwt() leídos de request.jwt.claims (como PostgREST), storage.objects
-- y las tablas de la tienda tal como existían antes de 001.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create schema storage;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

-- Supabase da todos los permisos sobre lo que se crea en public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  price numeric not null default 0,
  discount numeric default 0,
  stock integer not null default 0,
  category text,
  barcode text,
  image_url text,
  is_active boolean not null default true,
  in_campaign boolean not null default false
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_document text,
  shipping_address jsonb,
  payment_method text,
  items jsonb,
  total numeric,
  status text
);

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid,
  change_amount integer,
  stock_after numeric,
  reason text,
  note text
);

create table public.store_settings (
  id integer primary key,
  campaign_active boolean default false,
  campaign_name text,
  campaign_image_url text
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  product_id uuid
);

insert into public.store_settings (id, campaign_name) values (1, 'Campaña');
