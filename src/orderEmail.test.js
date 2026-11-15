import { describe, it, expect } from 'vitest';
import { buildOrderEmail, formatDelivery, orderTotals } from './orderEmail';

const order = {
  id: 'abc12345-0000-4000-8000-000000000000',
  created_at: '2026-11-15T18:30:00Z',
  customer_name: 'Ana Pérez',
  customer_email: 'ana@mail.com',
  customer_document: '30111222',
  payment_method: 'Transferencia',
  shipping_cost: 3500,
  total: 32300,
  shipping_address: { street: 'Alsina', number: '123', city: 'Bahía Blanca', state: 'Buenos Aires', zip: '8000' },
  items: [
    { id: 'p1', name: 'Remera — Talle M', product_name: 'Remera', variant: 'M', price: 18000, discount: 20, quantity: 1 },
    { id: 'p2', name: 'Gorra <script>', price: 7000, discount: 0, quantity: 2 }
  ]
};
const store = { name: 'Velas Luna', slug: 'velas', branding: { primary_color: '#4f46e5' } };
const settings = { store_name: 'Velas Luna', store_email: 'hola@velas.com', transfer_alias: 'velas.luna', transfer_holder: 'Ana Pérez', contact_whatsapp: '5492915551234' };

describe('mails de la compra', () => {
  it('el comprobante trae el detalle, el talle, el envío y el total', () => {
    const { subject, html, text } = buildOrderEmail('paid', { order: { ...order, payment_method: 'MercadoPago' }, store, settings, trackingUrl: 'https://velas.com/seguimiento' });
    expect(subject).toBe('Comprobante de compra #ABC12345 · Velas Luna');
    expect(html).toContain('Pago confirmado');
    expect(html).toContain('Talle M');
    expect(html).toContain('$3.500');     // envío
    expect(html).toContain('$32.300');    // total
    expect(html).toContain('Bahía Blanca');
    expect(html).toContain('https://velas.com/seguimiento');
    expect(html).toContain('#4f46e5');    // color de la tienda
    expect(text).toContain('Este mail es tu comprobante de compra.');
  });

  it('el de transferencia trae los datos para pagar y el plazo', () => {
    const { subject, html } = buildOrderEmail('received', { order, store, settings });
    expect(subject).toBe('Recibimos tu pedido #ABC12345 · Velas Luna');
    expect(html).toContain('velas.luna');
    expect(html).toContain('48 horas');
    expect(html).toContain('wa.me/5492915551234');
  });

  it('escapa lo que escribió el cliente o la tienda y no muestra el DNI', () => {
    const { html } = buildOrderEmail('paid', { order, store, settings });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Gorra &lt;script&gt;');
    expect(html).not.toContain('30111222');
  });

  it('cuentas y entrega', () => {
    expect(orderTotals(order)).toEqual({ subtotal: 28400, shipping: 3500, total: 32300 });
    expect(formatDelivery(null)).toMatch(/Retiro/);
  });

  it('no arma mails desconocidos', () => {
    expect(() => buildOrderEmail('otro', { order, store })).toThrow();
  });
});
