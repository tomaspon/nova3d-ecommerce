// Piezas compartidas por las funciones del panel (usuarios y plataforma).

// Devuelve el usuario si el token de sesión es de un administrador de plataforma
export async function requirePlatformAdmin(supabase, req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data?.user?.app_metadata?.role !== 'admin') return null;
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

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}
