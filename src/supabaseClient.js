import { createClient } from '@supabase/supabase-js';
import { isPlatformPath } from './sitePaths';
import { onPlatformHost } from './platformBrand';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Dos sesiones separadas en el mismo navegador, que nunca se pisan:
//  - "store": compradores en las tiendas (/, /producto, /perfil, /login...)
//  - "staff": el equipo, en el panel de cada tienda, el alta y el superadmin
//             (/panel, /crear, /ingresar, /superadmin, /admin)
// Cada una se guarda con su propia clave: iniciar sesión como cliente en una tienda no cambia
// la del superadmin (ni en otras pestañas), y al revés. Pasar de un lado al otro siempre es
// una carga completa de la página, así cada página arranca con el cliente que le corresponde.
export const AUTH_AREA = typeof window !== 'undefined' && (onPlatformHost() || isPlatformPath(window.location.pathname)) ? 'staff' : 'store';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: AUTH_AREA === 'staff'
    ? { storageKey: 'vitrina-staff-auth' }
    : {} // compradores: la clave de siempre (no se pierden las sesiones abiertas)
});
