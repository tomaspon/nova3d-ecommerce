// Tienda de muestra de la plataforma. La que se muestra es MINIMAL (la plantilla base), con
// estos productos cargados en la base (supabase/010_minimal_vitrina.sql) y sin poder comprar.
// ?tienda=demo lleva a MINIMAL; esta tienda incorporada (NORTE.) queda solo de respaldo,
// por si la base no responde.

export const DEMO_SLUG = 'demo';

export const DEMO_STORE = {
  id: 'demo',
  slug: DEMO_SLUG,
  name: 'NORTE.',
  status: 'active',
  template: 'ropa',
  branding: {},
  mp_connected: true,
  isDemo: true
};

export const DEMO_SETTINGS = {
  campaign_active: true,
  campaign_name: 'Summer Sale',
  campaign_image_url: 'preset:verano',
  store_name: 'NORTE.',
  store_email: '',
  shipping_cost: 3500,
  transfer_alias: 'norte.tienda',
  transfer_holder: 'NORTE.',
  contact_whatsapp: ''
};

const product = (id, name, description, price, discount, stock, category, image, inCampaign) => ({
  id: `demo-${id}`,
  store_id: 'demo',
  name,
  description,
  price,
  discount,
  stock,
  category,
  image_url: image,
  is_active: true,
  in_campaign: inCampaign,
  created_at: '2026-11-01T00:00:00Z'
});

export const DEMO_PRODUCTS = [
  product(1, 'Remera Oversize Terracota', 'Remera de algodón peinado 24/1, calce oversize y cuello reforzado.', 18000, 20, 24, 'Remeras', '/demo/remera.svg', true),
  product(2, 'Buzo Canguro Lila', 'Frisa de algodón, capucha forrada y bolsillo canguro.', 42000, 15, 12, 'Buzos', '/demo/buzo.svg', true),
  product(3, 'Camisa de Lino Celeste', 'Lino liviano con bolsillo al pecho y botones de nácar.', 32000, 0, 15, 'Camisas', '/demo/camisa.svg', false),
  product(4, 'Bermuda Gabardina Mostaza', 'Gabardina de algodón con bolsillos y cintura con presillas.', 26000, 10, 18, 'Bermudas', '/demo/bermuda.svg', true),
  product(5, 'Jean Recto Azul', 'Denim rígido de corte recto con costuras en contraste.', 39000, 10, 4, 'Pantalones', '/demo/jean.svg', true),
  product(6, 'Campera Bomber Oliva', 'Bomber de nylon con abrigo liviano, puños elastizados y bolsillo en la manga.', 68000, 0, 8, 'Camperas', '/demo/campera.svg', false)
];

export const DEMO_CHECKOUT_MESSAGE = 'Esta es una tienda de ejemplo: el carrito funciona, pero no se procesan compras reales.';
