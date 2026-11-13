-- ============================================================================
-- 004 · TIENDA DE EJEMPLO "NORTE." (enlace: demo)
-- Réplica de la configuración de MINIMAL con 5 productos de muestra ilustrados
-- (las imágenes están en public/demo/). Es la tienda que muestra la página oficial.
--
-- Además pausa los productos de MINIMAL: no se borran, se reactivan desde
-- Panel > Productos > "Activar Publicación". Los pedidos y la tienda quedan intactos.
--
-- Se puede ejecutar más de una vez: no duplica nada.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

-- La tienda, con la marca de MINIMAL
insert into public.stores (slug, name, template, branding)
select 'demo', 'NORTE.', 'ropa', s.branding
from public.stores s
where s.id = '00000000-0000-0000-0000-000000000001'
on conflict (slug) do nothing;

-- Su configuración: la de MINIMAL (envío, campaña, banner) con su propio nombre
insert into public.store_settings (store_id, store_name, shipping_cost, campaign_active, campaign_name, campaign_image_url)
select d.id, 'NORTE.', s.shipping_cost, s.campaign_active, s.campaign_name, s.campaign_image_url
from public.stores d
join public.store_settings s on s.store_id = '00000000-0000-0000-0000-000000000001'
where d.slug = 'demo'
  and not exists (select 1 from public.store_settings x where x.store_id = d.id);

-- Productos de muestra (solo si la tienda todavía no tiene ninguno)
insert into public.products (store_id, name, description, price, discount, stock, category, image_url, is_active, in_campaign)
select d.id, p.name, p.description, p.price, p.discount, p.stock, p.category, p.image_url, true, p.in_campaign
from public.stores d
cross join (values
  ('Remera Oversize Arena', 'Remera de algodón peinado 24/1, calce oversize y cuello reforzado. Color arena.', 18000, 0, 24, 'Remeras', '/demo/remera-arena.svg', false),
  ('Buzo Canguro Grafito', 'Frisa de algodón, capucha forrada y bolsillo canguro. Color grafito.', 42000, 15, 12, 'Buzos', '/demo/buzo-grafito.svg', true),
  ('Gorra Lavada Oliva', 'Gabardina lavada de seis paneles con bordado frontal. Talle único ajustable.', 15000, 0, 30, 'Accesorios', '/demo/gorra-oliva.svg', false),
  ('Tote Bag Natural', 'Lienzo 100% algodón con estampa serigrafiada y manijas largas.', 12000, 10, 40, 'Accesorios', '/demo/tote-natural.svg', true),
  ('Jogger Clásico Negro', 'Rústico de algodón con cintura elastizada, cordón y puños. Color negro.', 34000, 0, 4, 'Pantalones', '/demo/jogger-negro.svg', false)
) as p(name, description, price, discount, stock, category, image_url, in_campaign)
where d.slug = 'demo'
  and not exists (select 1 from public.products x where x.store_id = d.id);

-- Pausar los productos de MINIMAL (se reactivan desde su panel)
update public.products
set is_active = false
where store_id = '00000000-0000-0000-0000-000000000001'
  and is_active;
