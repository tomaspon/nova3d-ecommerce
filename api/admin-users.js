import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { summarizeUsers, DISABLE_BAN_DURATION } from '../src/adminUsers.js';

// Gestión de usuarios para el panel. Listar cuentas, desactivarlas o mandar el mail de
// restablecimiento necesita la service role key, que solo existe acá en el servidor.
// Cada pedido se valida con el token de sesión del administrador que lo hace.

const MAX_PAGES = 20; // hasta 20.000 cuentas
const ACTIONS = ['disable', 'enable', 'reset'];

async function requireAdmin(supabase, req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data?.user?.app_metadata?.role !== 'admin') return null;
  return data.user;
}

async function listAllUsers(supabase) {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}

export default async function handler(req, res) {
  if (!hasServiceKey()) {
    return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
  }

  try {
    const supabase = getSupabase();
    const admin = await requireAdmin(supabase, req);
    if (!admin) return res.status(401).json({ message: 'Solo para administradores.' });

    if (req.method === 'GET') {
      const [users, { data: orders, error: ordersError }] = await Promise.all([
        listAllUsers(supabase),
        supabase.from('orders').select('user_id, customer_email, status, total')
      ]);
      if (ordersError) throw ordersError;
      const list = summarizeUsers(users, orders || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.status(200).json({ users: list, currentAdminId: admin.id });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action, userId } = req.body || {};
    if (!ACTIONS.includes(action) || typeof userId !== 'string' || !userId) {
      return res.status(400).json({ message: 'Acción inválida.' });
    }

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !target?.user) return res.status(404).json({ message: 'No existe ese usuario.' });
    const user = target.user;

    if (action === 'reset') {
      if (!user.email) return res.status(400).json({ message: 'La cuenta no tiene email.' });
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${siteUrl(req)}/perfil?tab=datos`
      });
      if (error) {
        const tooMany = error.status === 429 || /rate limit/i.test(error.message);
        return res.status(tooMany ? 429 : 500).json({
          message: tooMany ? 'Se enviaron demasiados mails seguidos. Probá de nuevo en un rato.' : 'No se pudo enviar el mail.'
        });
      }
      return res.status(200).json({ message: `Mail de restablecimiento enviado a ${user.email}.` });
    }

    // Desactivar / reactivar: nunca a uno mismo ni a otro administrador
    if (user.id === admin.id || user.app_metadata?.role === 'admin') {
      return res.status(403).json({ message: 'Las cuentas de administrador no se pueden desactivar desde el panel.' });
    }
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      ban_duration: action === 'disable' ? DISABLE_BAN_DURATION : 'none'
    });
    if (error) throw error;
    return res.status(200).json({ message: action === 'disable' ? 'Cuenta desactivada.' : 'Cuenta reactivada.' });
  } catch (error) {
    console.error('admin-users:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
}
