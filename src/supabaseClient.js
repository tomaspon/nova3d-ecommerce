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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: STORAGE_KEYS[AUTH_AREA] ? { storageKey: STORAGE_KEYS[AUTH_AREA] } : {}
});
