import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Los clientes se crean dentro de la función: construirlos al cargar el módulo
// tira la función entera si falta una variable de entorno (Resend y Supabase lanzan con claves vacías).
// Minutos que dura la reserva de stock de una orden sin pagar (igual que en StoreContext)
export const RESERVATION_MINUTES = 10;

export function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan las variables de Supabase en Vercel.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Estados desde los que un pago aprobado convierte la orden en "pagado".
// Incluye la cancelación automática por tiempo: si el pago entró, la orden vale igual.
function isAwaitingPayment(status) {
  const s = (status || '').toLowerCase();
  return s.startsWith('reservado') || s.startsWith('pendiente') || s === 'cancelado (tiempo agotado)';
}

async function sendReceiptEmail(order, orderId) {
  if (!process.env.RESEND_API_KEY || !process.env.STORE_EMAIL_SENDER) {
    console.log('No se envió email porque falta RESEND_API_KEY o STORE_EMAIL_SENDER');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const shortId = orderId.split('-')[0].toUpperCase();

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.price * item.quantity).toLocaleString('es-AR')}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="text-align: center; color: #000;">Comprobante de Pago</h1>
        <p>¡Hola! Recibimos el pago de tu orden <strong>#${shortId}</strong> exitosamente.</p>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; border-bottom: 2px solid #000; padding-bottom: 10px;">Detalle de tu compra</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Producto</th>
                <th style="text-align: center; padding: 10px; border-bottom: 2px solid #eee;">Cant.</th>
                <th style="text-align: right; padding: 10px; border-bottom: 2px solid #eee;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="text-align: right; padding: 15px 10px; font-weight: bold;">Total Pagado:</td>
                <td style="text-align: right; padding: 15px 10px; font-weight: bold; font-size: 18px;">$${Number(order.total).toLocaleString('es-AR')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p style="text-align: center; color: #666; font-size: 12px; margin-top: 40px;">
          Este es un comprobante automático. Gracias por confiar en nosotros.
        </p>
      </div>
    `;

    const recipient = order.customer_email || order.user_email;
    await resend.emails.send({
      from: process.env.STORE_EMAIL_SENDER, // ej: 'Ventas <ventas@tudominio.com>' o 'onboarding@resend.dev'
      to: recipient,
      subject: `Comprobante de Pago - Orden #${shortId}`,
      html: emailHtml
    });

    console.log(`Email de comprobante enviado a ${recipient}`);
  } catch (emailErr) {
    console.error('Error enviando email:', emailErr);
  }
}

// Consulta el pago en MercadoPago y, si está aprobado, marca la orden como pagada y descuenta stock.
// Lo usan el webhook y la verificación al volver del checkout; es seguro llamarlo más de una vez.
export async function processPayment(paymentId) {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new Error('MP_ACCESS_TOKEN no está configurado en Vercel.');
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const paymentInfo = await new Payment(client).get({ id: paymentId });

  const orderId = paymentInfo.external_reference;
  const paymentStatus = paymentInfo.status; // 'approved'

  console.log(`Procesando pago ${paymentId} para orden ${orderId} con estado ${paymentStatus}`);

  if (!orderId || paymentStatus !== 'approved') {
    return { orderId: orderId || null, paymentStatus, orderStatus: null };
  }

  const supabase = getSupabase();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  if (!isAwaitingPayment(order.status)) {
    console.log(`La orden ${orderId} ya estaba en estado: ${order.status}.`);
    return { orderId, paymentStatus, orderStatus: order.status };
  }

  // El importe acreditado tiene que cubrir el total de la orden (con un peso de tolerancia por redondeo)
  const paidAmount = Number(paymentInfo.transaction_amount);
  if (!(paidAmount + 1 >= Number(order.total))) {
    console.error(`Pago ${paymentId} por ${paidAmount} no cubre el total ${order.total} de la orden ${orderId}.`);
    return { orderId, paymentStatus: 'amount_mismatch', orderStatus: order.status };
  }

  // 1. Actualizar estado a pagado. El filtro por estado evita descontar stock dos veces
  //    si el webhook y la verificación llegan al mismo tiempo.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'pagado' })
    .eq('id', orderId)
    .eq('status', order.status)
    .select();

  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    return { orderId, paymentStatus, orderStatus: 'pagado' };
  }

  // 2. Descontar stock fisico
  for (const item of order.items) {
    const { data: dbProd } = await supabase.from('products').select('stock').eq('id', item.id).single();
    if (dbProd) {
      const newStock = dbProd.stock - item.quantity;
      await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

      await supabase.from('inventory_logs').insert([{
        product_id: item.id,
        change_amount: -item.quantity,
        stock_after: newStock,
        reason: 'Venta',
        note: `Orden MP #${orderId.split('-')[0]}`
      }]);
    }
  }
  console.log(`Orden ${orderId} pagada y stock descontado exitosamente.`);

  // 3. Enviar Comprobante por Email (si Resend está configurado)
  await sendReceiptEmail(order, orderId);

  return { orderId, paymentStatus, orderStatus: 'pagado' };
}
