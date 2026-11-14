import { DEFAULT_STORE_ID } from './storeIds.js';

// Medios de pago que ofrece una tienda en el carrito:
// - MercadoPago, si conectó su cuenta (la tienda principal usa la de la plataforma);
// - Transferencia, si cargó alias o CBU para recibirla.
export function availablePaymentMethods(store, settings) {
  const methods = [];
  if (store && (store.mp_connected || store.id === DEFAULT_STORE_ID)) methods.push('MercadoPago');
  if (settings?.transfer_alias || settings?.transfer_cbu) methods.push('Transferencia');
  return methods;
}

// Link de WhatsApp de la tienda (solo números, con código de país). null si no cargó uno.
export function storeWhatsappLink(settings, text) {
  const digits = String(settings?.contact_whatsapp || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
