import { hasServiceKey } from './_lib/payments.js';

// Dice qué piezas de configuración están cargadas en Vercel, sin revelar ningún valor.
export default function handler(req, res) {
  res.status(200).json({
    serviceRoleKey: hasServiceKey(),
    mercadoPago: Boolean(process.env.MP_ACCESS_TOKEN),
    email: Boolean(process.env.RESEND_API_KEY && process.env.STORE_EMAIL_SENDER)
  });
}
