import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { requirePlatformAdmin, listAllUsers } from './_lib/platformAdmin.js';
import { buildPlatformStats } from '../src/platformStats.js';

// Estadísticas de toda la plataforma para el panel del administrador (GET).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
  if (!hasServiceKey()) return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });

  try {
    const supabase = getSupabase();
    const admin = await requirePlatformAdmin(supabase, req);
    if (!admin) return res.status(401).json({ message: 'Solo para el administrador de la plataforma.' });

    const [storesRes, ordersRes, productsRes, membersRes, users] = await Promise.all([
      supabase.from('stores').select('*'),
      supabase.from('orders').select('store_id, status, total, payment_method, created_at, items'),
      supabase.from('products').select('store_id, is_active'),
      supabase.from('store_members').select('store_id, user_id, role'),
      listAllUsers(supabase)
    ]);
    for (const r of [storesRes, ordersRes, productsRes, membersRes]) if (r.error) throw r.error;

    const stats = buildPlatformStats({
      stores: storesRes.data,
      orders: ordersRes.data,
      products: productsRes.data,
      members: membersRes.data,
      users: users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })),
      feePercent: Number(process.env.PLATFORM_FEE_PERCENT) || 0
    });
    return res.status(200).json(stats);
  } catch (error) {
    console.error('platform-stats:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
}
