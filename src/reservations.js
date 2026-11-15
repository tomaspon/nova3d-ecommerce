import { supabase } from './supabaseClient';
import { variantKey } from './productMapping';

// Las reglas de reserva viven en la base (supabase/001_estructura.sql y 011_talles.sql):
// una orden sin pagar retiene sus unidades 10 minutos (MercadoPago) o 48 horas (transferencia).

// Cancela las órdenes sin pagar que ya vencieron: su stock deja de estar reservado.
export async function releaseExpiredReservations() {
  const { error } = await supabase.rpc('release_expired_reservations');
  if (error) throw error;
}

// Unidades reservadas de una tienda:
//   { [productId]: total, ["<productId>::<talle>"]: lo reservado de ese talle }
export async function fetchReservedMap(storeId) {
  const { data, error } = await supabase.rpc('get_reserved_variants', { p_store_id: storeId });
  if (!error) {
    const reserved = {};
    for (const row of data || []) {
      reserved[row.product_id] = (reserved[row.product_id] || 0) + row.reserved;
      if (row.variant) reserved[variantKey(row.product_id, row.variant)] = row.reserved;
    }
    return reserved;
  }

  // Base sin la migración 011: solo totales por producto
  const fallback = await supabase.rpc('get_reserved_stock', { p_store_id: storeId });
  if (fallback.error) throw fallback.error;
  const reserved = {};
  for (const row of fallback.data || []) reserved[row.product_id] = row.reserved;
  return reserved;
}
