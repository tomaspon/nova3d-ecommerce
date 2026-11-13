import { supabase } from './supabaseClient';

// Qué tienda muestra este sitio. Un mismo despliegue sirve a todas las tiendas de la
// plataforma: se elige por el dominio (supabase/003_multitienda.sql, get_store_by_host).

// La primera tienda de la plataforma; también es la que se usa si el dominio no
// corresponde a ninguna (por ejemplo, el dominio de Vercel o localhost).
export const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_STORE_SLUG = import.meta.env?.VITE_DEFAULT_STORE || 'minimal';

const FALLBACK_STORE = { id: DEFAULT_STORE_ID, slug: 'minimal', name: 'MINIMAL.', status: 'active', template: 'ropa', branding: {} };
const OVERRIDE_KEY = 'store_override';

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

// En desarrollo se puede ver otra tienda con ?tienda=<slug> (queda guardado en la pestaña;
// ?tienda= vacío vuelve a la normal). En producción manda siempre el dominio.
export function storeOverride(location, storage) {
  if (!isLocalHost(location.hostname)) return null;
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

export async function resolveStore(location = window.location, storage = window.sessionStorage) {
  try {
    const override = storeOverride(location, storage);
    if (override) {
      const store = await rpcStore('get_store_by_slug', { p_slug: override });
      if (store) return store;
    }
    return (await rpcStore('get_store_by_host', { p_host: location.host }))
      || (await rpcStore('get_store_by_slug', { p_slug: DEFAULT_STORE_SLUG }))
      || FALLBACK_STORE;
  } catch (error) {
    // Sin conexión o base sin migrar: se sigue con la tienda por defecto
    console.error('No se pudo identificar la tienda:', error);
    return FALLBACK_STORE;
  }
}
