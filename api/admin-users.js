import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { summarizeUsers, DISABLE_BAN_DURATION } from '../src/adminUsers.js';
import { requirePlatformAdmin, listAllUsers, siteUrl } from './_lib/platformAdmin.js';
import { purgeAccount, isHardDeleteEnabled } from './_lib/purgeAccount.js';
import { DEFAULT_STORE_ID } from '../src/storeIds.js';
import { logApiError } from './_lib/guard.js';

// Gestión de usuarios para el panel. Listar cuentas, desactivarlas o mandar el mail de
// restablecimiento necesita la service role key, que solo existe acá en el servidor.
// Cada pedido se valida con el token de sesión del administrador que lo hace.

const ACTIONS = ['disable', 'enable', 'reset', 'purge'];

export default async function handler(req, res) {
  if (!hasServiceKey()) {
    return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
  }

  try {
    const supabase = getSupabase();
    const admin = await requirePlatformAdmin(supabase, req);
    if (!admin) return res.status(401).json({ message: 'Solo para administradores.' });

    if (req.method === 'GET') {
      const [users, { data: orders, error: ordersError }, { data: owners }, { data: stores }] = await Promise.all([
        listAllUsers(supabase),
        supabase.from('orders').select('user_id, customer_email, status, total'),
        supabase.from('store_members').select('store_id, user_id').eq('role', 'owner'),
        supabase.from('stores').select('id, slug, name')
      ]);
      if (ordersError) throw ordersError;
      // Tiendas de cada cuenta (para ver qué se borraría con ella)
      const storeById = new Map((stores || []).map(s => [s.id, s]));
      const ownersOf = (storeId) => (owners || []).filter(o => o.store_id === storeId).length;
      const list = summarizeUsers(users, orders || [])
        .map(u => ({
          ...u,
          stores: (owners || [])
            .filter(o => o.user_id === u.id && storeById.has(o.store_id))
            .map(o => ({ ...storeById.get(o.store_id), shared: ownersOf(o.store_id) > 1, protected: o.store_id === DEFAULT_STORE_ID }))
        }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.status(200).json({ users: list, currentAdminId: admin.id, hardDeleteEnabled: isHardDeleteEnabled() });
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

    // Borrado definitivo (herramienta temporal de pruebas): cuenta + tiendas de las que es único dueño
    if (action === 'purge') {
      if (!isHardDeleteEnabled()) return res.status(403).json({ message: 'El borrado definitivo está apagado.' });
      if (user.id === admin.id || user.app_metadata?.role === 'admin') {
        return res.status(403).json({ message: 'Las cuentas de administrador no se pueden borrar.' });
      }
      // Hay que escribir el email exacto de la cuenta: evita borrar otra por error
      const typed = String(req.body?.confirmEmail || '').trim().toLowerCase();
      if (!user.email || typed !== user.email.toLowerCase()) {
        return res.status(400).json({ message: 'El email escrito no coincide con el de la cuenta.' });
      }
      const result = await purgeAccount(supabase, user.id);
      console.log(`purge: ${admin.email} borró ${user.email} y ${result.deletedStores.length} tienda(s)`);
      const stores = result.deletedStores.map(s => s.name).join(', ');
      return res.status(200).json({
        message: `Se borró ${user.email}${stores ? ` y su tienda: ${stores}` : ''}.`,
        ...result
      });
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
    try { await logApiError(getSupabase(), 'admin-users', error); } catch { /* sin Supabase */ }
    return res.status(500).json({ message: 'Error interno.' });
  }
}
