import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { validateStoreRequest, TERMS_VERSION } from '../src/storeRequest.js';
import { logApiError } from './_lib/guard.js';

// Recibe las solicitudes de tienda de la página oficial (pública, sin sesión).
// Guarda junto con los datos cuándo y desde qué IP se aceptaron los términos: es la
// prueba del consentimiento que pide la Ley 25.326.

const MAX_PER_IP = 3;          // solicitudes por IP...
const WINDOW_MINUTES = 30;     // ...en esta ventana

const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  if (!hasServiceKey()) return res.status(503).json({ message: 'El formulario no está disponible en este momento.' });

  const body = req.body || {};

  // Campo trampa: invisible para las personas, los bots lo completan. Se responde "ok" sin guardar.
  if (body.website) return res.status(200).json({ message: '¡Recibimos tu solicitud!' });

  const { data, errors } = validateStoreRequest(body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Revisá los datos marcados.', errors });
  }

  try {
    const supabase = getSupabase();
    const ip = clientIp(req);

    if (ip) {
      const since = new Date(Date.now() - WINDOW_MINUTES * 60000).toISOString();
      const { count, error: countError } = await supabase.from('store_requests')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since);
      if (countError) throw countError;
      if (count >= MAX_PER_IP) {
        return res.status(429).json({ message: 'Ya recibimos varias solicitudes desde tu conexión. Probá más tarde o escribinos por WhatsApp.' });
      }
    }

    const { error } = await supabase.from('store_requests').insert({
      ...data,
      terms_version: TERMS_VERSION,
      accepted_at: new Date().toISOString(),
      ip,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300) || null
    });
    if (error) throw error;

    return res.status(200).json({ message: '¡Recibimos tu solicitud! Te contactamos en menos de 48 horas hábiles.' });
  } catch (error) {
    console.error('store-request:', error);
    try { await logApiError(getSupabase(), 'store-request', error); } catch { /* sin Supabase */ }
    return res.status(500).json({ message: 'No pudimos guardar tu solicitud. Probá de nuevo o escribinos por WhatsApp.' });
  }
}
