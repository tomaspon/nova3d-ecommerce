-- ============================================================================
-- 002 · SEGURIDAD (el candado)
-- Activa Row Level Security: a partir de acá la clave pública solo puede leer
-- el catálogo y la configuración; todo lo demás pasa por las funciones de 001
-- o requiere ser administrador.
--
-- CORRER SOLO DESPUÉS de que:
--   1) 001_estructura.sql esté aplicado,
--   2) la tienda publicada ya use esas funciones,
--   3) SUPABASE_SERVICE_ROLE_KEY esté cargada en Vercel.
-- Si se corre antes, los pagos dejan de confirmarse.
-- Se puede ejecutar más de una vez.
-- ============================================================================

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.store_settings enable row level security;
alter table public.favorites enable row level security;

-- Se parte de cero: se eliminan las políticas que hubiera en estas tablas
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('products', 'orders', 'inventory_logs', 'store_settings', 'favorites')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── Productos: catálogo público, cambios solo del administrador ─────────────
create policy "productos: lectura publica" on public.products
  for select using (true);
create policy "productos: alta admin" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "productos: edicion admin" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "productos: baja admin" on public.products
  for delete to authenticated using (public.is_admin());

-- ── Configuración: lectura pública, cambios solo del administrador ──────────
create policy "configuracion: lectura publica" on public.store_settings
  for select using (true);
create policy "configuracion: edicion admin" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Órdenes: cada cliente ve las suyas; el administrador, todas ─────────────
-- No hay política de alta: las órdenes se crean solo con create_order().
create policy "ordenes: lectura propia o admin" on public.orders
  for select to authenticated
  using (
    public.is_admin()
    or user_id = (select auth.uid())
    or customer_email = (select auth.jwt() ->> 'email')
  );
create policy "ordenes: edicion admin" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ordenes: baja admin" on public.orders
  for delete to authenticated using (public.is_admin());

-- ── Historial de inventario: solo el administrador ──────────────────────────
create policy "inventario: lectura admin" on public.inventory_logs
  for select to authenticated using (public.is_admin());
create policy "inventario: alta admin" on public.inventory_logs
  for insert to authenticated with check (public.is_admin());

-- ── Favoritos: cada cliente maneja los suyos ────────────────────────────────
create policy "favoritos: propios" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Permisos de tabla (RLS filtra filas; esto define qué operaciones existen) ─
revoke all on public.products, public.orders, public.inventory_logs, public.store_settings, public.favorites from anon;
grant select on public.products, public.store_settings to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.store_settings to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select, insert on public.inventory_logs to authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- ── Imágenes: cualquiera las ve (buckets públicos); solo el admin sube o borra ─
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
create policy "imagenes: alta admin" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('images', 'products', 'product-images') and public.is_admin());
create policy "imagenes: edicion admin" on storage.objects
  for update to authenticated
  using (bucket_id in ('images', 'products', 'product-images') and public.is_admin());
create policy "imagenes: baja admin" on storage.objects
  for delete to authenticated
  using (bucket_id in ('images', 'products', 'product-images') and public.is_admin());

notify pgrst, 'reload schema';
