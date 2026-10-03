import { escapeHtml } from './escapeHtml';
import { lineTotal, formatMoney } from './pricing';

const STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 30px; }
  .logo { font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -1px; }
  .title { font-size: 14px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
  .info-col p { margin: 5px 0; font-size: 14px; }
  .label { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; display: block; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
  th { text-align: left; padding: 10px 0; border-bottom: 2px solid #111; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 12px 0; border-bottom: 1px solid #eee; }
  .total-row { font-size: 20px; font-weight: 900; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888; }
  @media print { @page { margin: 0; } body { margin: 1.6cm; } }
`;

const formatAddress = (address) => {
  if (!address?.street) return 'Retiro en Local / A Coordinar';
  const line = `${address.street} ${address.number || ''}${address.apartment ? `, ${address.apartment}` : ''}`;
  return `${line}, ${address.city || ''} (${address.zip || ''}), ${address.state || ''}`;
};

// HTML del comprobante. Los datos de la orden los escribió un cliente, así que todo pasa por escapeHtml.
// showCustomerDetails: el comprobante del panel incluye DNI, teléfono y dirección; el del cliente no.
export function buildReceiptHtml(order, { showCustomerDetails = false } = {}) {
  const e = escapeHtml;
  const shortId = String(order?.id || '').split('-')[0].toUpperCase();
  const date = new Date(order?.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(showCustomerDetails ? { hour: '2-digit', minute: '2-digit' } : {})
  });

  const itemsHtml = (order?.items || []).map(item => `
    <tr>
      <td>${e(item.name)}</td>
      <td style="text-align: center;">${e(item.quantity)}</td>
      <td style="text-align: right;">${e(formatMoney(lineTotal(item)))}</td>
    </tr>
  `).join('');

  const shippingCost = Number(order?.shipping_cost) || 0;

  const customerBlock = showCustomerDetails
    ? `
      <span class="label">Datos del Cliente</span>
      <p><strong>${e(order.customer_name)}</strong></p>
      ${order.customer_document ? `<p>DNI: ${e(order.customer_document)}</p>` : ''}
      <p>${e(order.customer_email)}</p>
      ${order.customer_phone ? `<p>Tel: ${e(order.customer_phone)}</p>` : ''}`
    : `
      <span class="label">Cliente</span>
      <p>${e(order.customer_email)}</p>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Comprobante #${e(shortId)}</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <div class="header">
      <div class="logo">MINIMAL.</div>
      <div class="title">Comprobante de ${showCustomerDetails ? 'Orden' : 'Compra'}</div>
    </div>

    <div class="info-grid">
      <div class="info-col">${customerBlock}</div>
      <div class="info-col">
        <span class="label">Detalle de la operación</span>
        <p>Orden: #${e(shortId)}</p>
        <p>Fecha: ${e(date)}</p>
        <p>Estado: ${e(String(order.status || '').toUpperCase())}</p>
        <p>Medio de pago: ${e(order.payment_method || 'MercadoPago')}</p>
      </div>
    </div>

    ${showCustomerDetails ? `
    <div style="margin-bottom: 40px;">
      <span class="label">Destino de entrega</span>
      <p>${e(formatAddress(order.shipping_address))}</p>
    </div>` : ''}

    <table>
      <thead>
        <tr>
          <th>Artículo</th>
          <th style="text-align: center;">Cant.</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="text-align: right; border-top: 2px solid #111; padding-top: 20px;">
      ${shippingCost > 0 ? `<p>Envío: ${e(formatMoney(shippingCost))}</p>` : ''}
      <div class="total-row">Total: ${e(formatMoney(order?.total))}</div>
    </div>

    <div class="footer">
      Comprobante de su compra en MINIMAL. Gracias por confiar en nosotros.
    </div>
  </body>
</html>`;
}

export function printReceipt(order, options) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(buildReceiptHtml(order, options));
  printWindow.document.close();
  printWindow.focus();
  // Esperar a que el documento esté dibujado antes de abrir el diálogo de impresión
  setTimeout(() => printWindow.print(), 300);
}
