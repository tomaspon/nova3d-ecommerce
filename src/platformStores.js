// Reglas de la plataforma multi-tienda que comparten el panel y el servidor.

// Rubros: los usan el formulario de solicitud y la creación de tiendas.
// Los ids quedan guardados en la base (stores.template): no cambiarlos, solo agregar.
export const STORE_TEMPLATES = [
  { id: 'ropa', label: 'Ropa e indumentaria' },
  { id: 'calzado', label: 'Calzado' },
  { id: 'accesorios', label: 'Accesorios y bijou' },
  { id: 'carteras', label: 'Carteras y marroquinería' },
  { id: 'infantil', label: 'Bebés y niños' },
  { id: 'cosmetica', label: 'Cosmética y cuidado personal' },
  { id: 'velas', label: 'Velas, aromas y deco' },
  { id: 'hogar', label: 'Hogar y bazar' },
  { id: 'plantas', label: 'Plantas y jardín' },
  { id: 'alimentos', label: 'Alimentos y bebidas' },
  { id: 'regalos', label: 'Regalos, arte y papelería' },
  { id: 'deportes', label: 'Deportes y fitness' },
  { id: 'mascotas', label: 'Mascotas' },
  { id: 'tecnologia', label: 'Tecnología y accesorios para celular' },
  { id: 'general', label: 'Otro rubro' }
];

// Nombres que no pueden ser tiendas: chocarían con subdominios o rutas de la plataforma
const RESERVED_SLUGS = ['www', 'app', 'api', 'admin', 'plataforma', 'panel', 'mail', 'localhost', 'nova3d-ecommerce', 'demo'];

// Mismas reglas que la base (stores.slug): minúsculas, números y guiones, sin guion en los bordes
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

export function slugify(name) {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export function slugError(slug) {
  if (!SLUG_PATTERN.test(slug || '')) return 'Usá entre 1 y 40 letras minúsculas, números o guiones (sin guion al principio ni al final).';
  if (RESERVED_SLUGS.includes(slug)) return 'Ese nombre está reservado por la plataforma.';
  return null;
}

// "https://www.VelasLuna.com.ar/tienda" → "velasluna.com.ar"
export function normalizeDomain(input) {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const isValidDomain = (domain) => DOMAIN_PATTERN.test(domain || '');

// A dónde lleva cada tienda: su dominio propio, su subdominio de la plataforma o,
// mientras no haya dominio de plataforma, la dirección actual con ?tienda=<slug>.
export function storeUrls(store, { origin, platformDomain } = {}) {
  let base;
  if (store.custom_domain) base = `https://${store.custom_domain}`;
  else if (platformDomain) base = `https://${store.slug}.${platformDomain}`;

  if (base) return { storefront: base, admin: `${base}/admin` };
  return {
    storefront: `${origin}/?tienda=${store.slug}`,
    admin: `${origin}/admin?tienda=${store.slug}`
  };
}
