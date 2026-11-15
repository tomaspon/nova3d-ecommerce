// Mails al cliente de una compra, con la marca de la tienda:
//   received  pedido con transferencia: datos para transferir, plazo y resumen
//   paid      comprobante de compra: pago confirmado, detalle, envío, total y seguimiento
// Función pura (sin red): arma asunto, HTML y texto. La envía api/_lib/orderEmails.js.
// Todo lo que escribió un cliente o la tienda pasa por escapeHtml antes de entrar al HTML.
import { escapeHtml } from './escapeHtml.js';
import { lineTotal, unitPrice, formatMoney } from './pricing.js';
import { inkFor } from './branding.js';
import { storeWhatsappLink } from './paymentMethods.js';

export const TRANSFER_HOURS = 48;

const e = escapeHtml;
const shortIdOf = (order) => String(order?.id || '').split('-')[0].toUpperCase();
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// "Remera — Talle M" → "Talle M" (la base guarda el nombre con la opción, ver 011_talles.sql)
const variantText = (item) => {
  if (!item.variant) return '';
  const parts = String(item.name || '').split(' — ');
  return parts.length > 1 ? parts.slice(1).join(' — ') : `Talle ${item.variant}`;
};

export function formatOrderDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
}

export function formatDelivery(address) {
  if (!address?.street) return 'Retiro en el local o a coordinar con la tienda';
  const line = `${address.street} ${address.number || ''}`.trim() + (address.apartment ? `, ${address.apartment}` : '');
  const place = [address.city, address.state].filter(Boolean).join(', ');
  return [line, place, address.zip ? `CP ${address.zip}` : ''].filter(Boolean).join(' · ');
}

// Totales del comprobante: subtotal de artículos, envío y total (el total es el que guardó la base)
export function orderTotals(order) {
  const items = order?.items || [];
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const shipping = Number(order?.shipping_cost) || 0;
  return { subtotal, shipping, total: Number(order?.total) || subtotal + shipping };
}

function layout({ store, brand, preheader, body, footer }) {
  const logo = /^https:\/\//.test(store.branding?.logo_url || '')
    ? `<img src="${e(store.branding.logo_url)}" alt="${e(store.name)}" height="44" style="display:block;max-height:44px;max-width:180px;border:0">`
    : `<span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#111">${e(store.name)}</span>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(store.name)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="padding:28px 32px 20px;border-bottom:4px solid ${brand}">${logo}</td></tr>
  <tr><td style="padding:28px 32px">${body}</td></tr>
  <tr><td style="padding:20px 32px 28px;background:#fafafa;font-size:12px;line-height:1.6;color:#71717a">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const button = (href, label, brand, ink) =>
  `<a href="${e(href)}" style="display:inline-block;background:${brand};color:${ink};text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${e(label)}</a>`;

function itemsTable(order) {
  const { subtotal, shipping, total } = orderTotals(order);
  const rows = (order.items || []).map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px">
        <strong>${e(item.product_name || item.name)}</strong>
        ${item.variant ? `<br><span style="color:#71717a;font-size:12px">${e(variantText(item))}</span>` : ''}
        ${Number(item.discount) > 0 ? `<br><span style="color:#16a34a;font-size:12px">${e(item.discount)}% OFF</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:center;white-space:nowrap">${e(item.quantity)} × ${e(formatMoney(unitPrice(item)))}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;white-space:nowrap">${e(formatMoney(lineTotal(item)))}</td>
    </tr>`).join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
    <tr>
      <th align="left" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;padding-bottom:6px;border-bottom:2px solid #18181b">Artículo</th>
      <th align="center" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;padding-bottom:6px;border-bottom:2px solid #18181b">Cant.</th>
      <th align="right" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;padding-bottom:6px;border-bottom:2px solid #18181b">Importe</th>
    </tr>
    ${rows}
    <tr><td colspan="2" style="padding:12px 0 2px;font-size:14px;color:#52525b">Subtotal</td><td align="right" style="padding:12px 0 2px;font-size:14px">${e(formatMoney(subtotal))}</td></tr>
    <tr><td colspan="2" style="padding:2px 0;font-size:14px;color:#52525b">Envío</td><td align="right" style="padding:2px 0;font-size:14px">${shipping > 0 ? e(formatMoney(shipping)) : 'Sin cargo'}</td></tr>
    <tr><td colspan="2" style="padding:10px 0 0;font-size:18px;font-weight:900">Total</td><td align="right" style="padding:10px 0 0;font-size:18px;font-weight:900">${e(formatMoney(total))}</td></tr>
  </table>`;
}

const detailRow = (label, value) =>
  `<tr><td style="padding:3px 0;font-size:13px;color:#71717a;width:42%">${e(label)}</td><td style="padding:3px 0;font-size:13px;font-weight:600">${e(value)}</td></tr>`;

/**
 * @param {'received'|'paid'} kind
 * @param {{ order, store, settings, trackingUrl }} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildOrderEmail(kind, { order, store, settings = {}, trackingUrl }) {
  if (!['received', 'paid'].includes(kind)) throw new Error(`Mail desconocido: ${kind}`);
  const storeName = settings.store_name || store?.name || 'Tienda online';
  const brandColor = /^#[0-9a-f]{6}$/i.test(store?.branding?.primary_color || '') ? store.branding.primary_color : '#0b0b0b';
  const brand = brandColor;
  const ink = inkFor(brandColor);
  const shopStore = { ...store, name: storeName };
  const shortId = shortIdOf(order);
  const name = firstName(order.customer_name);
  const { total } = orderTotals(order);
  const delivery = formatDelivery(order.shipping_address);
  const contact = [
    settings.store_email ? `escribinos a ${settings.store_email}` : null,
    settings.contact_whatsapp ? `por WhatsApp al +${String(settings.contact_whatsapp).replace(/\D/g, '')}` : null
  ].filter(Boolean).join(' o ');
  const footer = `${kind === 'paid' ? '<strong style="color:#18181b">Este mail es tu comprobante de compra.</strong> Guardalo. ' : ''}
    ¿Dudas con tu pedido? ${contact ? e(`Respondé este mail, ${contact}.`) : 'Respondé este mail.'}<br>${e(storeName)}`;

  const details = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fafafa;border-radius:12px;padding:14px 16px">
      ${detailRow('Pedido', `#${shortId}`)}
      ${detailRow('Fecha', formatOrderDate(order.created_at))}
      ${detailRow('Medio de pago', order.payment_method || 'MercadoPago')}
      ${detailRow('Entrega', delivery)}
    </table>`;

  if (kind === 'received') {
    const lines = [
      settings.transfer_alias && ['Alias', settings.transfer_alias],
      settings.transfer_cbu && ['CBU / CVU', settings.transfer_cbu],
      settings.transfer_holder && ['Titular', settings.transfer_holder]
    ].filter(Boolean);
    const whatsapp = storeWhatsappLink(settings, `¡Hola! Hice el pedido #${shortId} por ${formatMoney(total)} y ya transferí. Te paso el comprobante:`);
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25">¡${name ? `Gracias, ${e(name)}` : 'Gracias'}! Recibimos tu pedido</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3f3f46">Para confirmarlo, transferí <strong>${e(formatMoney(total))}</strong> a esta cuenta. Te guardamos los productos por <strong>${TRANSFER_HOURS} horas</strong>: si no llega el pago, el pedido se cancela solo.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${brand};border-radius:12px;padding:14px 16px;margin-bottom:16px">
        ${lines.map(([label, value]) => detailRow(label, value)).join('')}
        ${detailRow('Importe', formatMoney(total))}
      </table>
      ${whatsapp ? `<p style="margin:0 0 6px">${button(whatsapp, 'Enviar el comprobante por WhatsApp', brand, ink)}</p>` : ''}
      ${details}
      <h2 style="margin:22px 0 4px;font-size:16px">Resumen de tu pedido</h2>
      ${itemsTable(order)}
      ${trackingUrl ? `<p style="margin:22px 0 0;font-size:13px;color:#52525b">Podés ver el estado de tu pedido en <a href="${e(trackingUrl)}" style="color:#18181b">Seguimiento</a> con tu DNI.</p>` : ''}`;
    const text = [
      `¡Gracias! Recibimos tu pedido #${shortId} en ${storeName}.`,
      `Para confirmarlo, transferí ${formatMoney(total)} (tenés ${TRANSFER_HOURS} horas):`,
      ...lines.map(([l, v]) => `${l}: ${v}`),
      '',
      ...(order.items || []).map(i => `${i.quantity} × ${i.name} — ${formatMoney(lineTotal(i))}`),
      `Total: ${formatMoney(total)}`,
      `Entrega: ${delivery}`,
      trackingUrl ? `Seguimiento: ${trackingUrl}` : ''
    ].filter(l => l !== null).join('\n');
    return {
      subject: `Recibimos tu pedido #${shortId} · ${storeName}`,
      html: layout({ store: shopStore, brand, preheader: `Transferí ${formatMoney(total)} para confirmarlo. Te guardamos los productos ${TRANSFER_HOURS} horas.`, body, footer }),
      text
    };
  }

  // paid: comprobante de compra
  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#16a34a">Pago confirmado</p>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25">¡${name ? `Gracias por tu compra, ${e(name)}` : 'Gracias por tu compra'}!</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46">Ya estamos preparando tu pedido. Te avisamos cuando salga.</p>
    ${details}
    <h2 style="margin:22px 0 4px;font-size:16px">Comprobante de compra</h2>
    ${itemsTable(order)}
    ${trackingUrl ? `<p style="margin:26px 0 0">${button(trackingUrl, 'Seguir mi pedido', brand, ink)}</p>` : ''}`;
  const text = [
    `¡Gracias por tu compra! Pago confirmado. Pedido #${shortId} en ${storeName}.`,
    `Fecha: ${formatOrderDate(order.created_at)} · Medio de pago: ${order.payment_method || 'MercadoPago'}`,
    '',
    ...(order.items || []).map(i => `${i.quantity} × ${i.name} — ${formatMoney(lineTotal(i))}`),
    `Envío: ${orderTotals(order).shipping > 0 ? formatMoney(orderTotals(order).shipping) : 'Sin cargo'}`,
    `Total pagado: ${formatMoney(total)}`,
    `Entrega: ${delivery}`,
    trackingUrl ? `Seguimiento: ${trackingUrl}` : '',
    '',
    'Este mail es tu comprobante de compra.'
  ].join('\n');
  return {
    subject: `Comprobante de compra #${shortId} · ${storeName}`,
    html: layout({ store: shopStore, brand, preheader: `Pago confirmado: ${formatMoney(total)}. Acá tenés el detalle de tu compra.`, body, footer }),
    text
  };
}
