// Tienda de ejemplo de la plataforma (NORTE.), incorporada en el código: no usa la base de
// datos, así nunca muestra productos reales de otra tienda ni recibe pedidos de verdad.
// Se abre con ?tienda=demo (la página oficial la muestra encuadrada).

export const DEMO_SLUG = 'demo';

export const DEMO_STORE = {
  id: 'demo',
  slug: DEMO_SLUG,
  name: 'NORTE.',
  status: 'active',
  template: 'ropa',
  branding: {},
  isDemo: true
};

export const DEMO_SETTINGS = {
  campaign_active: true,
  campaign_name: 'Summer Sale',
  campaign_image_url: 'preset:verano',
  store_name: 'NORTE.',
  store_email: '',
  shipping_cost: 3500
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
  product(1, 'Remera Oversize Arena', 'Remera de algodón peinado 24/1, calce oversize y cuello reforzado. Color arena.', 18000, 0, 24, 'Remeras', '/demo/remera-arena.svg', false),
  product(2, 'Buzo Canguro Grafito', 'Frisa de algodón, capucha forrada y bolsillo canguro. Color grafito.', 42000, 15, 12, 'Buzos', '/demo/buzo-grafito.svg', true),
  product(3, 'Gorra Lavada Oliva', 'Gabardina lavada de seis paneles con bordado frontal. Talle único ajustable.', 15000, 0, 30, 'Accesorios', '/demo/gorra-oliva.svg', false),
  product(4, 'Tote Bag Natural', 'Lienzo 100% algodón con estampa serigrafiada y manijas largas.', 12000, 10, 40, 'Accesorios', '/demo/tote-natural.svg', true),
  product(5, 'Jogger Clásico Negro', 'Rústico de algodón con cintura elastizada, cordón y puños. Color negro.', 34000, 0, 4, 'Pantalones', '/demo/jogger-negro.svg', false)
];

export const DEMO_CHECKOUT_MESSAGE = 'Esta es una tienda de ejemplo: el carrito funciona, pero no se procesan compras reales.';
