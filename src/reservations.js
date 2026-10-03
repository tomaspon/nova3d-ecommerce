import { supabase } from './supabaseClient';
import { ORDER_STATUS, RESERVATION_MINUTES, TRANSFER_RESERVATION_HOURS, holdsReservation } from './orderStatus';

const OPEN_STATUSES = ['reservado', 'pendiente'];

// Cancela las órdenes sin pagar que ya vencieron: su stock deja de estar reservado.
export async function releaseExpiredReservations() {
  const mpLimit = new Date(Date.now() - RESERVATION_MINUTES * 60000).toISOString();
  const transferLimit = new Date(Date.now() - TRANSFER_RESERVATION_HOURS * 3600000).toISOString();

  await Promise.all([
    supabase.from('orders').update({ status: ORDER_STATUS.EXPIRED })
      .in('status', OPEN_STATUSES).neq('payment_method', 'Transferencia').lt('created_at', mpLimit),
    supabase.from('orders').update({ status: ORDER_STATUS.EXPIRED })
      .in('status', OPEN_STATUSES).eq('payment_method', 'Transferencia').lt('created_at', transferLimit)
  ]);
}

// Unidades reservadas por producto: { [productId]: cantidad }.
// Cuenta solo las órdenes que esperan pago y siguen dentro de su plazo.
export async function fetchReservedMap() {
  const transferLimit = new Date(Date.now() - TRANSFER_RESERVATION_HOURS * 3600000).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .select('items, status, payment_method, created_at')
    .in('status', OPEN_STATUSES)
    .gt('created_at', transferLimit);

  if (error) throw error;

  const reserved = {};
  for (const order of data || []) {
    if (!holdsReservation(order)) continue;
    for (const item of order.items || []) {
      reserved[item.id] = (reserved[item.id] || 0) + (Number(item.quantity) || 0);
    }
  }
  return reserved;
}
