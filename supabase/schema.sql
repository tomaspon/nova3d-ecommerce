-- Esquema de la tienda. Ejecutar una sola vez en Supabase > SQL Editor.

-- ── TABLAS ──

create table public.categories (
  name text primary key,
  created_at timestamptz not null default now()
);

create sequence public.product_code_seq start 1001;

create table public.products (
  id text primary key default 'PROD-' || nextval('public.product_code_seq'),
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  discount integer not null default 0 check (discount between 0 and 100),
  category text references public.categories (name) on update cascade on delete restrict,
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Usuarios que pueden administrar la tienda (ver el final del archivo)
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- ── PERMISOS ──

grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;
grant usage on sequence public.product_code_seq to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admins enable row level security;

-- Cualquiera lee las categorías; solo los admins las modifican
create policy "Categorias: lectura publica" on public.categories
  for select using (true);
create policy "Categorias: alta solo admins" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "Categorias: edicion solo admins" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Categorias: baja solo admins" on public.categories
  for delete to authenticated using (public.is_admin());

-- El público ve solo los productos activos; los admins ven todos
create policy "Productos: lectura publica de activos" on public.products
  for select using (is_active or public.is_admin());
create policy "Productos: alta solo admins" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "Productos: edicion solo admins" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Productos: baja solo admins" on public.products
  for delete to authenticated using (public.is_admin());

-- ── IMÁGENES ──

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Imagenes: alta solo admins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "Imagenes: edicion solo admins" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "Imagenes: baja solo admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ── DATOS INICIALES ──

insert into public.categories (name) values ('Muebles'), ('Iluminación'), ('Decoración');

-- ── ALTA DEL ADMINISTRADOR ──
-- 1) Creá el usuario en Authentication > Users > Add user (email y contraseña).
-- 2) Reemplazá el email y ejecutá:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'tu-email@ejemplo.com';
