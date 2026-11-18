import { processPayment } from './_lib/payments.js';
import { DEFAULT_STORE_ID } from '../src/storeIds.js';
import { logApiError } from './_lib/guard.js';
import { getSupabase } from './_lib/payments.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
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
