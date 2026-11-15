// Mapa de direcciones de la plataforma.
//
//   Plataforma (vitrina.com.ar, o la dirección aparte de Vercel)
//     /                     página oficial (sin dirección aparte: /inicio)
//     /crear  /terminos     alta de tienda y términos
//     /ingresar → /panel    acceso de los emprendedores y lista de sus tiendas
//     /panel/<tienda>/...   panel de cada tienda (la tienda va en la dirección)
//     /superadmin/...       panel de la plataforma, con verificación en dos pasos
//   Tienda (<tienda>.vitrina.com.ar, su dominio propio o ?tienda=)
//     /  /producto/..  /seguimiento ...    lo que ve el comprador
//     /admin                               lleva al panel de esa tienda en la plataforma

export const PANEL_SECTIONS = [
  { id: '', label: 'Resumen' },
  { id: 'productos', label: 'Productos' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'ofertas', label: 'Ofertas' },
  { id: 'ordenes', label: 'Órdenes' },
  { id: 'envios', label: 'Envíos' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'configuracion', label: 'Config.' },
  { id: 'ayuda', label: 'Ayuda' }
];

export const panelPath = (slug, section = '') =>
  `/panel/${encodeURIComponent(slug || '')}${section ? `/${section}` : ''}`;

const PANEL_RE = /^\/panel\/([a-z0-9-]+)(?:\/([a-z-]+))?/;
export const panelSlugFromPath = (pathname = '') => PANEL_RE.exec(pathname)?.[1] || null;
export const panelSectionFromPath = (pathname = '') => PANEL_RE.exec(pathname)?.[2] || '';

export const SUPERADMIN = '/superadmin';

// Rutas que pertenecen a la plataforma (no a la tienda): no llevan la marca ni el título de la tienda
const PLATFORM_PREFIXES = ['/inicio', '/crear', '/terminos', '/ingresar', '/panel', SUPERADMIN, '/plataforma', '/admin'];
export const isPlatformPath = (pathname = '') =>
  PLATFORM_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));

// Direcciones viejas (antes de separar plataforma y tiendas), para que los links guardados sigan andando
const OLD_ADMIN_SECTIONS = {
  products: 'productos', categories: 'categorias', orders: 'ordenes', shipping: 'envios',
  settings: 'configuracion', diseno: 'diseno', ayuda: 'ayuda'
};
export const adminSectionFromOldPath = (pathname = '') => {
  const old = /^\/admin\/([a-z]+)/.exec(pathname)?.[1];
  return old ? OLD_ADMIN_SECTIONS[old] || '' : '';
};

export function oldPlatformPath(pathname = '') {
  if (pathname === '/plataforma/inicio') return '/';
  if (pathname === '/plataforma/crear') return '/crear';
  if (pathname === '/plataforma/terminos') return '/terminos';
  const rest = /^\/plataforma(\/.*)?$/.exec(pathname);
  return rest ? `${SUPERADMIN}${rest[1] || ''}` : null;
}
