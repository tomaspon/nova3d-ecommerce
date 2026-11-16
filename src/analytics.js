import { supabase } from './supabaseClient';

// Registro de tráfico de la tienda (supabase/013_trafico.sql). Anónimo: cada visita lleva solo
// una marca al azar que dura lo que dura la pestaña; nunca IP, email ni nombre.
// No se registra: la vista previa del panel, la tienda de ejemplo encuadrada en la página
// oficial, ni quien pidió "no rastrear" en su navegador.

const SESSION_KEY = 'vt_visita';

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export const deviceFor = (width) => (width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop');

// De dónde llegó: solo el dominio, y solo si es otro sitio (Instagram, Google...)
export function externalReferrer(referrer, ownHost) {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}

const isEmbedded = () => { try { return window.self !== window.top; } catch { return true; } };
let referrerSent = false;

/**
 * @param {object} store  la tienda actual (StoreContext)
 * @param {'page_view'|'product_view'|'add_to_cart'|'checkout_start'|'order_placed'} type
 * @param {{ path?: string, productId?: string }} [data]
 */
export function track(store, type, { path, productId } = {}) {
  if (typeof window === 'undefined' || !store?.id || store.isDemo || isEmbedded()) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  const session = sessionId();
  if (!session) return;

  // El origen va una sola vez por visita, con lo primero que se registra
  const referrer = referrerSent ? null : externalReferrer(document.referrer, window.location.hostname);
  referrerSent = true;

  supabase.rpc('track_event', {
    p_store_id: store.id,
    p_session: session,
    p_type: type,
    p_path: path || null,
    p_product_id: productId || null,
    p_referrer: referrer,
    p_device: deviceFor(window.innerWidth)
  }).then(() => {}, () => {}); // el registro nunca molesta a quien compra
}
