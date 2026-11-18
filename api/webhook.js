import { processPayment } from './_lib/payments.js';
import { DEFAULT_STORE_ID } from '../src/storeIds.js';
import { logApiError } from './_lib/guard.js';
import { getSupabase } from './_lib/payments.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Firma de MercadoPago (Tus integraciones › Webhooks › Clave secreta), si se cargó MP_WEBHOOK_SECRET en Vercel.
// Es una capa extra: el pago igual se consulta siempre a MercadoPago antes de marcar nada.
export function validMpSignature(req, secret) {
  if (!secret) return true;
  const header = String(req.headers['x-signature'] || '');
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=')).filter(p => p.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const rawId = String(req.query?.['data.id'] ?? req.body?.data?.id ?? '');
  const id = /^[a-z0-9]+$/i.test(rawId) ? rawId.toLowerCase() : rawId;
  const requestId = String(req.headers['x-request-id'] || '');
  const manifest = `${id ? `id:${id};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  if (!validMpSignature(req, process.env.MP_WEBHOOK_SECRET)) {
    return res.status(401).send('Firma inválida');
  }

  try {
    const { type, action, data } = req.body || {};
    const { topic, id: queryId, store } = req.query;

    const isPayment = type === 'payment' || topic === 'payment' || (action && action.startsWith('payment'));
    const paymentId = data?.id || queryId;

    console.log('Recibido Webhook de MP:', { type, action, topic, paymentId });

    if (isPayment && paymentId) {
      // Cada preferencia avisa con ?store=<id>: con la cuenta de esa tienda se consulta el pago.
      // Las preferencias viejas no lo traen: eran todas de la tienda principal.
      await processPayment(paymentId, typeof store === 'string' && store ? store : DEFAULT_STORE_ID);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook MP:', error);
    try { await logApiError(getSupabase(), 'webhook', error); } catch { /* sin Supabase */ }
    res.status(500).send('Internal Server Error');
  }
}
