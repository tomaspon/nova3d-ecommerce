// Envío de los mails de una compra (contenido en src/orderEmail.js).
// Reglas:
//  - "received" solo para pedidos con transferencia que siguen esperando el pago.
//  - "paid" solo cuando la orden ya está pagada (o en una etapa posterior).
//  - Cada uno sale UNA vez: se toma en la base antes de enviar (claim_order_email, 012_mails.sql)
//    y, si el envío falla, se libera para poder reintentar.
// Sin RESEND_API_KEY / STORE_EMAIL_SENDER en Vercel no se manda nada (y no rompe la compra).
import { Resend } from 'resend';
import { buildOrderEmail } from '../../src/orderEmail.js';
import { isPaid, isAwaitingPayment } from '../../src/orderStatus.js';

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.STORE_EMAIL_SENDER);

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

// "Ventas <ventas@tudominio.com>" o "ventas@tudominio.com" → la dirección
export function senderAddress(sender = process.env.STORE_EMAIL_SENDER || '') {
  const inside = /<([^>]+)>/.exec(sender)?.[1] || sender;
  return EMAIL.test(inside.trim()) ? inside.trim() : null;
}

// El remitente lleva el nombre de la tienda; la dirección es la verificada de la plataforma
export function fromHeader(storeName, sender) {
  const address = senderAddress(sender);
  if (!address) return null;
  const name = String(storeName || '').replace(/["<>\r\n]/g, '').trim().slice(0, 60);
  return name ? `${name} <${address}>` : address;
}

// Seguimiento en la dirección de la tienda: dominio propio, subdominio de la plataforma o ?tienda=
export function trackingUrlFor(store, env = process.env) {
  if (!store?.slug) return null;
  if (store.custom_domain) return `https://${store.custom_domain}/seguimiento`;
  if (env.PLATFORM_DOMAIN) return `https://${store.slug}.${env.PLATFORM_DOMAIN}/seguimiento`;
  const origin = (env.STORES_ORIGIN || env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '');
  return origin ? `${origin}/seguimiento?tienda=${encodeURIComponent(store.slug)}` : null;
}

const RECEIVED_WINDOW_MS = 48 * 60 * 60 * 1000;

function shouldSend(kind, order, now = Date.now()) {
  if (!order?.customer_email || !EMAIL.test(order.customer_email)) return false;
  if (kind === 'paid') return isPaid(order.status);
  if (kind === 'received') {
    return order.payment_method === 'Transferencia'
      && isAwaitingPayment(order.status)
      && now - new Date(order.created_at).getTime() < RECEIVED_WINDOW_MS;
  }
  return false;
}

/**
 * Manda (una sola vez) el mail `kind` de la orden. Nunca tira error: devuelve qué pasó.
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function sendOrderEmail(supabase, orderId, kind, { resend } = {}) {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };

    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error) throw error;
    if (!order) return { sent: false, reason: 'not_found' };
    if (!shouldSend(kind, order)) return { sent: false, reason: 'not_applicable' };

    // Se toma antes de enviar: si dos avisos llegan juntos, solo uno manda
    const { data: claimed, error: claimError } = await supabase.rpc('claim_order_email', { p_order_id: orderId, p_kind: kind });
    if (claimError) {
      console.error('order-email: falta supabase/012_mails.sql o falló la marca:', claimError.message);
      return { sent: false, reason: 'claim_failed' };
    }
    if (!claimed) return { sent: false, reason: 'already_sent' };

    const [{ data: store }, { data: settings }] = await Promise.all([
      supabase.from('stores').select('id, slug, name, branding, custom_domain').eq('id', order.store_id).maybeSingle(),
      supabase.from('store_settings').select('*').eq('store_id', order.store_id).maybeSingle()
    ]);

    const email = buildOrderEmail(kind, { order, store: store || {}, settings: settings || {}, trackingUrl: trackingUrlFor(store) });
    const replyTo = EMAIL.test(settings?.store_email || '') ? settings.store_email : undefined;
    const client = resend || new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await client.emails.send({
      from: fromHeader(settings?.store_name || store?.name, process.env.STORE_EMAIL_SENDER) || process.env.STORE_EMAIL_SENDER,
      to: order.customer_email,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text
    }) || {};

    if (sendError) {
      // Se libera para poder reintentar más tarde
      await supabase.rpc('claim_order_email', { p_order_id: orderId, p_kind: kind, p_release: true });
      console.error(`order-email: no se pudo enviar "${kind}" de ${orderId}:`, sendError.message || sendError);
      return { sent: false, reason: 'send_failed' };
    }
    return { sent: true };
  } catch (err) {
    console.error('order-email:', err);
    return { sent: false, reason: 'error' };
  }
}
