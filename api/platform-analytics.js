import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { requirePlatformAdmin } from './_lib/platformAdmin.js';

// Tráfico e interacciones de las tiendas, para el superadmin (GET ?days=30&store=<id>).
// Los eventos son anónimos (supabase/013_trafico.sql) y solo los lee el servidor.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
  if (!hasServiceKey()) return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });

  try {
    const supabase = getSupabase();
    const admin = await requirePlatformAdmin(supabase, req);
    if (!admin) return res.status(401).json({ message: 'Solo para el administrador de la plataforma.' });

    const days = Math.min(Math.max(parseInt(req.query?.days, 10) || 30, 1), 365);
    const store = UUID.test(String(req.query?.store || '')) ? req.query.store : null;
    const { data, error } = await supabase.rpc('analytics_summary', { p_days: days, p_store_id: store });
    if (error) {
      if (/analytics_summary|function/i.test(error.message || '')) {
        return res.status(503).json({ message: 'Falta actualizar la base: corré supabase/013_trafico.sql en Supabase.' });
      }
      throw error;
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('platform-analytics:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
}
