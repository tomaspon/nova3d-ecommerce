import { supabase } from './supabaseClient';
import { DEFAULT_STORE_ID } from './storeIds';
import { DEMO_STORE, DEMO_SLUG } from './demoStore';
import { panelSlugFromPath } from './sitePaths';

// La tienda principal (MINIMAL) es la plantilla base y la tienda de muestra de la página
// oficial: se navega y se usa el carrito, pero no se compra (ver isShowcaseStore).
const markShowcase = (store, resolvedBy) => {
  if (!store) return store;
  const marked = resolvedBy ? { ...store, resolvedBy } : store;
  return marked.id === DEFAULT_STORE_ID ? { ...marked, isShowcase: true } : marked;
};

// Dirección de una página de la tienda que sirve en un link de mail o en otra pestaña:
// si la tienda se eligió con ?tienda=, el link la lleva; con dominio propio no hace falta.
export function storeHref(store, path = '/') {
  const url = new URL(path, window.location.origin);
  if (store?.resolvedBy === 'override' && store.slug) url.searchParams.set('tienda', store.slug);
  return url.toString();
}

// ?tienda=demo lleva a MINIMAL. Si la base no responde, queda la tienda incorporada (NORTE.).
async function demoStore() {
  try {
    const base = await rpcStore('get_store_by_slug', { p_slug: DEFAULT_STORE_SLUG });
    if (base) return markShowcase(base);
  } catch { /* sin conexión: tienda incorporada */ }
  return { ...DEMO_STORE, branding: { ...DEMO_STORE.branding } };
}

// Qué tienda muestra este sitio. Un mismo despliegue sirve a todas las tiendas de la
// plataforma: se elige por el dominio (supabase/003_multitienda.sql, get_store_by_host).

export { DEFAULT_STORE_ID };
export const DEFAULT_STORE_SLUG = import.meta.env?.VITE_DEFAULT_STORE || 'minimal';

const FALLBACK_STORE = { id: DEFAULT_STORE_ID, slug: 'minimal', name: 'MINIMAL.', status: 'active', template: 'ropa', branding: {} };
// Dentro de una vista encuadrada (la demo de la página oficial) se guarda aparte: el
// sessionStorage es de toda la pestaña y no tiene que cambiar la tienda de la página que la contiene.
const isFramed = () => {
  try { return typeof window !== 'undefined' && window.self !== window.top; } catch { return true; }
};
const OVERRIDE_KEY = isFramed() ? 'store_override_embed' : 'store_override';

// Fuera del dominio de una tienda (localhost, la dirección de Vercel, el dominio de la
// plataforma) se elige la tienda con ?tienda=<slug>. Queda guardada en la pestaña;
// ?tienda= vacío vuelve a la tienda por defecto. En el dominio de una tienda, manda el dominio.
export function storeOverride(location, storage) {
  const params = new URLSearchParams(location.search);
  if (params.has('tienda')) {
    const slug = params.get('tienda').trim().toLowerCase();
    try {
      if (slug) storage?.setItem(OVERRIDE_KEY, slug);
      else storage?.removeItem(OVERRIDE_KEY);
    } catch { /* almacenamiento bloqueado: se usa solo para esta carga */ }
    return slug || null;
  }
  try {
    return storage?.getItem(OVERRIDE_KEY) || null;
  } catch {
    return null;
  }
}

async function rpcStore(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data || null;
}

// Tienda de muestra: no se compra ni se usa la sesión de quien la mira
export const isShowcaseStore = (store) => Boolean(store?.isDemo || store?.isShowcase);

export async function resolveStore(location = window.location, storage = window.sessionStorage) {
  // En el panel (/panel/<tienda>/...) manda la dirección: nunca se cae a otra tienda
  const panelSlug = panelSlugFromPath(location.pathname);
  if (panelSlug) {
    if (panelSlug === DEMO_SLUG) return DEMO_STORE;
    try {
      const store = await rpcStore('get_store_by_slug', { p_slug: panelSlug });
      if (store) return markShowcase(store);
    } catch (error) {
      console.error('No se pudo identificar la tienda:', error);
    }
    return { id: null, slug: panelSlug, name: '', branding: {}, notFound: true };
  }

  try {
    const byHost = await rpcStore('get_store_by_host', { p_host: location.host });
    if (byHost) return markShowcase(byHost, 'host');

    const override = storeOverride(location, storage);
    if (override === DEMO_SLUG) return demoStore();
    if (override) {
      const store = await rpcStore('get_store_by_slug', { p_slug: override });
      if (store) return markShowcase(store, 'override');
    }
    return markShowcase((await rpcStore('get_store_by_slug', { p_slug: DEFAULT_STORE_SLUG })) || FALLBACK_STORE, 'default');
  } catch (error) {
    // Sin conexión o base sin migrar: se sigue con la tienda por defecto
    console.error('No se pudo identificar la tienda:', error);
    return FALLBACK_STORE;
  }
}
