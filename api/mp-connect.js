import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { signState } from './_lib/secrets.js';
import { isMpOAuthConfigured, authorizationUrl, disconnectAccount } from './_lib/mercadopago.js';
import { isPlatformAdmin } from './_lib/platformAdmin.js';

// Conexión de MercadoPago desde el panel de una tienda (POST, con el token de sesión):
//   status      { storeId }  → si está conectada y con qué cuenta
//   start       { storeId }  → URL de MercadoPago para autorizar (el panel redirige ahí)
//   disconnect  { storeId }  → borra la cuenta conectada
// Solo para quien administra esa tienda (su dueño o la plataforma).

async function canManageStore(supabase, req, storeId) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || typeof storeId !== 'string') return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  if (isPlatformAdmin(data.user, token)) return data.user;
  const { data: member } = await supabase.from('store_members')
    .select('store_id').eq('store_id', storeId).eq('user_id', data.user.id).maybeSingle();
  return member ? data.user : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  if (!hasServiceKey()) return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });

  try {
    const supabase = getSupabase();
    const { action, storeId } = req.body || {};
    const user = await canManageStore(supabase, req, storeId);
    if (!user) return res.status(403).json({ message: 'No administrás esa tienda.' });

    if (action === 'status') {
      const { data: account, error } = await supabase.from('store_payment_accounts')
        .select('mp_user_id, live_mode, connected_at, expires_at').eq('store_id', storeId).maybeSingle();
      if (error) throw error;
      return res.status(200).json({ configured: isMpOAuthConfigured(), connected: Boolean(account), account });
    }

    if (action === 'start') {
      if (!isMpOAuthConfigured()) {
        return res.status(503).json({ message: 'La conexión con MercadoPago todavía no está configurada en la plataforma.' });
      }
      const state = signState({ s: storeId, u: user.id });
      return res.status(200).json({ url: authorizationUrl(state) });
    }

    if (action === 'disconnect') {
      await disconnectAccount(supabase, storeId);
      return res.status(200).json({ message: 'MercadoPago desconectado.' });
    }

    return res.status(400).json({ message: 'Acción inválida.' });
  } catch (error) {
    console.error('mp-connect:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
}
