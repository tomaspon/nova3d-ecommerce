// Estados de una orden y cómo leerlos. El estado se guarda como texto y algunos llevan
// un detalle entre paréntesis ("cancelado (tiempo agotado)"), por eso se compara por prefijo.

export const ORDER_STATUS = {
  RESERVED: 'reservado',
  PAID: 'pagado',
  PREPARING: 'preparando',
  SHIPPED: 'enviado',
  DELIVERED: 'entregado',
  CANCELED: 'cancelado',
  EXPIRED: 'cancelado (tiempo agotado)'
};

// Minutos que una orden sin pagar retiene el stock (lo que dura el link de MercadoPago)
export const RESERVATION_MINUTES = 10;
// Las transferencias se confirman a mano: tienen más tiempo
export const TRANSFER_RESERVATION_HOURS = 48;

const normalize = (status) => (status || '').toLowerCase().trim();
const startsWithAny = (status, prefixes) => prefixes.some(p => normalize(status).startsWith(p));

// Creada pero todavía sin pago acreditado ("pendiente" es el nombre viejo de "reservado")
export const isAwaitingPayment = (status) => startsWithAny(status, ['reservado', 'pendiente']);

export const isCanceled = (status) => startsWithAny(status, ['cancelado']);

// Pagada, en cualquier etapa posterior al pago
export const isPaid = (status) => startsWithAny(status, ['pagado', 'preparando', 'enviado', 'despachado', 'entregado']);

// Etapa para la barra de seguimiento: 1 ordenado, 2 preparando, 3 enviado, 4 entregado
export function trackingStep(status) {
  if (startsWithAny(status, ['entregado'])) return 4;
  if (startsWithAny(status, ['enviado', 'despachado'])) return 3;
  if (startsWithAny(status, ['preparando'])) return 2;
  return 1;
}

// ¿La orden sigue reteniendo stock? Solo las que esperan pago y no vencieron.
export function holdsReservation(order, now = Date.now()) {
  if (!isAwaitingPayment(order?.status)) return false;
  const ageMs = now - new Date(order.created_at).getTime();
  const limitMs = order.payment_method === 'Transferencia'
    ? TRANSFER_RESERVATION_HOURS * 3600000
    : RESERVATION_MINUTES * 60000;
  return ageMs < limitMs;
}
