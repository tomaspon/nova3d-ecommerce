import { supabase } from './supabaseClient';

// Las reglas de reserva viven en la base (supabase/001_estructura.sql):
// una orden sin pagar retiene sus unidades 10 minutos (MercadoPago) o 48 horas (transferencia).

// Cancela las órdenes sin pagar que ya vencieron: su stock deja de estar reservado.
export async function releaseExpiredReservations() {
  const { error } = await supabase.rpc('release_expired_reservations');
  if (error) throw error;
}

// Unidades reservadas por producto: { [productId]: cantidad }
export async function fetchReservedMap() {
  const { data, error } = await supabase.rpc('get_reserved_stock');
  if (error) throw error;

  const reserved = {};
  for (const row of data || []) {
    reserved[row.product_id] = row.reserved;
  }
  return reserved;
}
