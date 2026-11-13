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
  product(1, 'Remera Oversize Coral', 'Remera de algodón peinado 24/1, calce oversize y cuello reforzado.', 18000, 20, 24, 'Remeras', '/demo/remera.svg', true),
  product(2, 'Buzo Canguro Lila', 'Frisa de algodón, capucha forrada y bolsillo canguro.', 42000, 15, 12, 'Buzos', '/demo/buzo.svg', true),
  product(3, 'Camisa de Lino Celeste', 'Lino liviano con bolsillos al pecho y botones de nácar.', 32000, 0, 15, 'Camisas', '/demo/camisa.svg', false),
  product(4, 'Bermuda Gabardina Mostaza', 'Gabardina de algodón con bolsillos y cintura con presillas.', 26000, 10, 18, 'Bermudas', '/demo/bermuda.svg', true),
  product(5, 'Jean Recto Azul', 'Denim rígido de corte recto con costuras en contraste.', 39000, 10, 4, 'Pantalones', '/demo/jean.svg', true)
];

export const DEMO_CHECKOUT_MESSAGE = 'Esta es una tienda de ejemplo: el carrito funciona, pero no se procesan compras reales.';
