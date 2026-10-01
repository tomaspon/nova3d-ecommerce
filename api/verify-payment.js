import { processPayment } from './_lib/payments.js';

// La página de seguimiento llama acá al volver de MercadoPago, para no depender
// de que el webhook llegue antes que el cliente. El estado del pago siempre se consulta a MP.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const paymentId = String(req.body?.paymentId || '');
    if (!/^\d+$/.test(paymentId)) {
      return res.status(400).json({ message: 'Bad Request: paymentId inválido' });
    }

    const result = await processPayment(paymentId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error verificando pago MP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
