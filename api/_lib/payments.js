import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { sendOrderEmail } from './orderEmails.js';
import { getStoreMpToken } from './mercadopago.js';
import { DEFAULT_STORE_ID } from '../../src/storeIds.js';

// Los clientes se crean dentro de la función: construirlos al cargar el módulo
// tira la función entera si falta una variable de entorno (Resend y Supabase lanzan con claves vacías).
// Minutos que dura la reserva de stock de una orden sin pagar (igual que en StoreContext)
export const RESERVATION_MINUTES = 10;

// Con la service role key el servidor actúa como parte de confianza: puede leer órdenes
// y confirmar pagos aunque la base esté cerrada al público.
export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan las variables de Supabase en Vercel.');
  }
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Estados desde los que un pago aprobado convierte la orden en "pagado".
// Incluye la cancelación automática por tiempo: si el pago entró, la orden vale igual.
function isAwaitingPayment(status) {
  const s = (status || '').toLowerCase();
  return s.startsWith('reservado') || s.startsWith('pendiente') || s === 'cancelado (tiempo agotado)';
}

// Consulta el pago en MercadoPago y, si está aprobado, marca la orden como pagada y descuenta stock.
// Lo usan el webhook y la verificación al volver del checkout; es seguro llamarlo más de una vez.
// storeId: la tienda cuya cuenta de MercadoPago recibió el pago (con su token se consulta).
export async function processPayment(paymentId, storeId = DEFAULT_STORE_ID, supabase = getSupabase()) {
  const credentials = await getStoreMpToken(supabase, storeId);
  if (!credentials) {
    throw new Error(`La tienda ${storeId} no tiene MercadoPago conectado.`);
  }

  const client = new MercadoPagoConfig({ accessToken: credentials.token });
  const paymentInfo = await new Payment(client).get({ id: paymentId });

  const orderId = paymentInfo.external_reference;
  const paymentStatus = paymentInfo.status; // 'approved'

  console.log(`Procesando pago ${paymentId} para orden ${orderId} con estado ${paymentStatus}`);

  if (!orderId || paymentStatus !== 'approved') {
    return { orderId: orderId || null, paymentStatus, orderStatus: null };
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  // El pago tiene que ser de la misma tienda que la orden: si no, un vendedor podría usar
  // un pago de su propia cuenta para marcar como pagada la orden de otra tienda.
  if ((order.store_id || DEFAULT_STORE_ID) !== storeId) {
    console.error(`Pago ${paymentId} de la tienda ${storeId} apunta a la orden ${orderId} de otra tienda.`);
    return { orderId, paymentStatus: 'store_mismatch', orderStatus: order.status };
  }

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

  // Camino normal: la base marca el pago y descuenta el stock en una sola operación
  // (mark_order_paid bloquea la orden, así el webhook y la verificación no descuentan dos veces).
  if (hasServiceKey()) {
    const { data: newStatus, error: paidError } = await supabase.rpc('mark_order_paid', {
      p_order_id: orderId,
      p_paid_amount: paidAmount
    });
    if (paidError) throw paidError;
    console.log(`Orden ${orderId} marcada como ${newStatus}.`);
    await sendOrderEmail(supabase, orderId, 'paid'); // comprobante de compra (una sola vez)
    return { orderId, paymentStatus, orderStatus: newStatus };
  }

  // Camino anterior, solo mientras falte SUPABASE_SERVICE_ROLE_KEY en Vercel

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


  return { orderId, paymentStatus, orderStatus: 'pagado' };
}
