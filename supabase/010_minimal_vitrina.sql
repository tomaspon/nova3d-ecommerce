-- ============================================================================
-- 010 · MINIMAL COMO TIENDA DE MUESTRA
-- MINIMAL (la plantilla base) es la tienda que muestra la página oficial. Esto:
--   1) BORRA los productos que tenía (y su historial de stock y favoritos). No se puede deshacer.
--   2) Le carga los productos de ejemplo (fotos en /demo/*.svg) y la campaña de temporada.
-- En la web, MINIMAL no deja comprar: el botón de confirmar se presiona pero no hace nada.
-- Después de 011, los productos de ejemplo tienen talles.
--
-- Se puede ejecutar más de una vez: no duplica productos ni borra los de ejemplo.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

-- 1) Productos anteriores de MINIMAL (todo lo que no es de ejemplo)
create temp table if not exists minimal_viejos (id uuid primary key);
truncate minimal_viejos;
insert into minimal_viejos
select p.id from public.products p
where p.store_id = '00000000-0000-0000-0000-000000000001'
  and coalesce(p.image_url, '') not like '/demo/%';

delete from public.favorites      where product_id in (select id from minimal_viejos);
delete from public.inventory_logs where product_id in (select id from minimal_viejos);
delete from public.products       where id in (select id from minimal_viejos);
drop table minimal_viejos;

-- 2) Productos de ejemplo
insert into public.products (store_id, name, description, price, discount, stock, category, image_url, is_active, in_campaign)
select '00000000-0000-0000-0000-000000000001', p.name, p.description, p.price, p.discount, p.stock, p.category, p.image_url, true, p.in_campaign
from (values
  ('Remera Oversize Terracota', 'Remera de algodón peinado 24/1, calce oversize y cuello reforzado.', 18000, 20, 24, 'Remeras', '/demo/remera.svg', true),
  ('Buzo Canguro Lila', 'Frisa de algodón, capucha forrada y bolsillo canguro.', 42000, 15, 12, 'Buzos', '/demo/buzo.svg', true),
  ('Camisa de Lino Celeste', 'Lino liviano con bolsillo al pecho y botones de nácar.', 32000, 0, 15, 'Camisas', '/demo/camisa.svg', false),
  ('Bermuda Gabardina Mostaza', 'Gabardina de algodón con bolsillos y cintura con presillas.', 26000, 10, 18, 'Bermudas', '/demo/bermuda.svg', true),
  ('Jean Recto Azul', 'Denim rígido de corte recto con costuras en contraste.', 39000, 10, 4, 'Pantalones', '/demo/jean.svg', true),
  ('Campera Bomber Oliva', 'Bomber de nylon con abrigo liviano, puños elastizados y bolsillo en la manga.', 68000, 0, 8, 'Camperas', '/demo/campera.svg', false)
) as p(name, description, price, discount, stock, category, image_url, in_campaign)
where not exists (
  select 1 from public.products x
  where x.store_id = '00000000-0000-0000-0000-000000000001' and x.name = p.name
);

-- 3) Campaña de temporada (banner de la portada)
update public.store_settings
set campaign_active = true,
    campaign_name = coalesce(nullif(campaign_name, ''), 'Summer Sale'),
    campaign_image_url = coalesce(nullif(campaign_image_url, ''), 'preset:verano')
where store_id = '00000000-0000-0000-0000-000000000001';
