import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { sendOrderEmail } from './_lib/orderEmails.js';

// POST { orderId, kind: 'received' | 'paid' }
// Lo llaman la tienda al crear un pedido con transferencia y el panel al confirmar un pago.
// Es seguro aunque lo llame cualquiera: el servidor decide si corresponde mandarlo según el
// estado REAL de la orden en la base, y cada mail sale una sola vez.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  const { orderId, kind } = req.body || {};
  if (!UUID.test(String(orderId || '')) || !['received', 'paid'].includes(kind)) {
    return res.status(400).json({ message: 'Pedido inválido.' });
  }
  if (!hasServiceKey()) return res.status(200).json({ sent: false });

  const result = await sendOrderEmail(getSupabase(), orderId, kind);
  // No se informa el motivo: no da pistas sobre órdenes ajenas
  return res.status(200).json({ sent: result.sent });
}
