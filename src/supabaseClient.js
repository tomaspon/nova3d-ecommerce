import { createClient } from '@supabase/supabase-js';
import { isPlatformPath, SUPERADMIN } from './sitePaths';
import { onPlatformHost } from './platformBrand';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tres inicios de sesión separados en el mismo navegador, que nunca se pisan:
//  - "store":      compradores en las tiendas (/, /producto, /perfil, /login...)
//  - "panel":      dueños de tiendas (/panel, /crear, /ingresar, /admin) y la página oficial
//  - "superadmin": la plataforma (/superadmin), con verificación en dos pasos
// Cada uno se guarda con su propia clave: entrar como cliente o como dueño de una tienda no
// cambia la sesión del superadmin (ni en otras pestañas), y al revés. Pasar de un área a otra
// siempre es una carga completa de la página, así cada una arranca con su propia sesión.
export function authAreaFor(pathname, platformHost = false) {
  if (pathname === SUPERADMIN || pathname.startsWith(`${SUPERADMIN}/`) || pathname.startsWith('/plataforma')) return 'superadmin';
  if (platformHost || isPlatformPath(pathname)) return 'panel';
  return 'store';
}

export const AUTH_AREA = typeof window === 'undefined' ? 'store' : authAreaFor(window.location.pathname, onPlatformHost());

const STORAGE_KEYS = {
  panel: 'vitrina-panel-auth',
  superadmin: 'vitrina-superadmin-auth'
  // store: la clave de siempre (los compradores no pierden su sesión abierta)
};

// ── Enlaces del mail (confirmar cuenta, entrar con Google, cambiar la clave) ──
// Si Supabase no tiene la dirección de vuelta en su lista permitida, manda a la dirección principal
// y la sesión quedaría en el área equivocada. Antes de mandar el mail se anota a dónde tenía que
// volver; si el enlace aterriza en otra página de este mismo sitio, se reenvía ahí con la sesión.
const RETURN_KEY = 'vitrina_auth_return';
export function rememberAuthReturn(url) {
  try { localStorage.setItem(RETURN_KEY, JSON.stringify({ url: String(url), at: Date.now() })); } catch { /* sin almacenamiento */ }
}

export function authReturnTarget(location, saved, now = Date.now()) {
  if (!/access_token=|error_description=/.test(location.hash || '')) return null;
  if (!saved?.url || now - saved.at > 7 * 86400000) return null;
  try {
    const target = new URL(saved.url);
    if (target.origin !== location.origin) return null;
    if (target.pathname === location.pathname) return null;
    return `${target.origin}${target.pathname}${target.search}${location.hash}`;
  } catch {
    return null;
  }
}

function redirectAuthReturn() {
  if (typeof window === 'undefined') return false;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(RETURN_KEY) || 'null'); } catch { /* dato roto */ }
  const target = authReturnTarget(window.location, saved);
  if (/access_token=|error_description=/.test(window.location.hash)) {
    try { localStorage.removeItem(RETURN_KEY); } catch { /* sin almacenamiento */ }
  }
  if (!target) return false;
  window.location.replace(target);
  return true;
}
const redirecting = redirectAuthReturn();

// El enlace venció o ya se usó (lo muestra AuthLinkNotice)
export const AUTH_LINK_ERROR = (() => {
  if (typeof window === 'undefined' || redirecting) return '';
  const params = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return params.get('error_description') || params.get('error_code') || '';
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(STORAGE_KEYS[AUTH_AREA] ? { storageKey: STORAGE_KEYS[AUTH_AREA] } : {}),
    // Si se está reenviando a la página correcta, la sesión la toma esa página
    detectSessionInUrl: !redirecting
  }
});
