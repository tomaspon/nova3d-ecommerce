-- ============================================================================
-- 004 · PAUSAR LOS PRODUCTOS DE MINIMAL
-- Los saca de la tienda sin borrarlos. Se reactivan uno por uno desde
-- Panel > Productos > "Activar Publicación". Pedidos y tienda quedan intactos.
--
-- La tienda de ejemplo (NORTE.) no está en la base: viene incorporada en el código
-- (src/demoStore.js), así nunca se mezcla con productos reales.
--
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

update public.products
set is_active = false
where store_id = '00000000-0000-0000-0000-000000000001'
  and is_active;
