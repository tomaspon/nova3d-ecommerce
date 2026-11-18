import { processPayment, getSupabase } from './_lib/payments.js';
import { DEFAULT_STORE_ID } from '../src/storeIds.js';
import { overLimit, logApiError } from './_lib/guard.js';

// La página de seguimiento llama acá al volver de MercadoPago, para no depender
// de que el webhook llegue antes que el cliente. El estado del pago siempre se consulta a MP,
// con la cuenta de la tienda de esa orden.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const paymentId = String(req.body?.paymentId || '');
    const orderId = String(req.body?.orderId || '');
    if (await overLimit(getSupabase(), req, 'verify-payment', 30, 600)) {
      return res.status(429).json({ message: 'Demasiadas consultas seguidas.' });
    }
    if (!/^\d+$/.test(paymentId)) {
      return res.status(400).json({ message: 'Bad Request: paymentId inválido' });
    }

    let storeId = DEFAULT_STORE_ID;
    if (orderId) {
      const { data: order } = await getSupabase().from('orders').select('store_id').eq('id', orderId).maybeSingle();
      if (order?.store_id) storeId = order.store_id;
    }

    const result = await processPayment(paymentId, storeId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error verificando pago MP:', error);
    await logApiError(getSupabase(), 'verify-payment', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
