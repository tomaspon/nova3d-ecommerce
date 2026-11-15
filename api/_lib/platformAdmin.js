// Piezas compartidas por las funciones del panel (usuarios y plataforma).

export const bearerToken = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

// Nivel de verificación de la sesión ("aal1" solo contraseña, "aal2" con el código del celular).
// Se lee del token después de validarlo con getUser (que confirma la firma con Supabase).
export function tokenAal(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')).aal || null;
  } catch {
    return null;
  }
}

// Administrador de plataforma = rol "admin" Y sesión verificada en dos pasos.
// Con solo la contraseña no alcanza (igual que en la base: supabase/009_seguridad_superadmin.sql).
export const isPlatformAdmin = (user, token) => user?.app_metadata?.role === 'admin' && tokenAal(token) === 'aal2';

// Devuelve el usuario si el token de sesión es de un administrador de plataforma
export async function requirePlatformAdmin(supabase, req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !isPlatformAdmin(data?.user, token)) return null;
  return data.user;
}

const MAX_PAGES = 20; // hasta 20.000 cuentas

export async function listAllUsers(supabase) {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

// Dirección de la plataforma (paneles y alta). PLATFORM_URL en Vercel, ej. https://vitrina-app.vercel.app
export function platformUrl(req) {
  if (process.env.PLATFORM_URL) return process.env.PLATFORM_URL.replace(/\/$/, '');
  return siteUrl(req);
}

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}
