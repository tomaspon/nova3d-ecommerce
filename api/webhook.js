import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY || '');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { type, action, data } = req.body;
    const { topic, id: queryId } = req.query;
    
    const isPayment = type === 'payment' || topic === 'payment' || (action && action.startsWith('payment'));
    const paymentId = data?.id || queryId;

    console.log('Recibido Webhook de MP:', { type, action, topic, paymentId });

    if (isPayment && paymentId) {
      if (!process.env.MP_ACCESS_TOKEN) {
        throw new Error("MP_ACCESS_TOKEN no está configurado en Vercel.");
      }

      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId });
      
      const orderId = paymentInfo.external_reference;
      const status = paymentInfo.status; // 'approved'

      console.log(`Procesando pago ${paymentId} para orden ${orderId} con estado ${status}`);

      if (orderId && status === 'approved') {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        if (order.status === 'reservado' || order.status === 'pendiente') {
          // 1. Actualizar estado a pagado
          await supabase.from('orders').update({ status: 'pagado' }).eq('id', orderId);

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
          if (process.env.RESEND_API_KEY && process.env.STORE_EMAIL_SENDER) {
            try {
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

              await resend.emails.send({
                from: process.env.STORE_EMAIL_SENDER, // ej: 'Ventas <ventas@tudominio.com>' o 'onboarding@resend.dev'
                to: order.user_email,
                subject: `Comprobante de Pago - Orden #${shortId}`,
                html: emailHtml
              });
              
              console.log(`Email de comprobante enviado a ${order.user_email}`);
            } catch (emailErr) {
              console.error('Error enviando email:', emailErr);
            }
          } else {
            console.log('No se envió email porque falta RESEND_API_KEY o STORE_EMAIL_SENDER');
          }

        } else {
          console.log(`La orden ${orderId} ya estaba en estado: ${order.status}.`);
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook MP:', error);
    res.status(500).send('Internal Server Error');
  }
}
