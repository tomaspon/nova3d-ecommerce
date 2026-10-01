import { processPayment } from './_lib/payments.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { type, action, data } = req.body || {};
    const { topic, id: queryId } = req.query;

    const isPayment = type === 'payment' || topic === 'payment' || (action && action.startsWith('payment'));
    const paymentId = data?.id || queryId;

    console.log('Recibido Webhook de MP:', { type, action, topic, paymentId });

    if (isPayment && paymentId) {
      await processPayment(paymentId);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook MP:', error);
    res.status(500).send('Internal Server Error');
  }
}
