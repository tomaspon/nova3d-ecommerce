import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendOrderEmail, fromHeader, trackingUrlFor } from '../api/_lib/orderEmails.js';

const ORDER = 'abc12345-0000-4000-8000-000000000000';

// Base falsa: una orden, su tienda y la marca de mails enviados (como claim_order_email)
function fakeSupabase(order) {
  const sent = {};
  const tables = {
    orders: [order],
    stores: [{ id: 'velas', slug: 'velas', name: 'Velas Luna', branding: {}, custom_domain: null }],
    store_settings: [{ store_id: 'velas', store_name: 'Velas Luna', store_email: 'hola@velas.com' }]
  };
  return {
    sent,
    from: (table) => {
      const filters = [];
      const q = {
        select: () => q,
        eq: (col, val) => { filters.push([col, val]); return q; },
        maybeSingle: async () => ({ data: tables[table].find(r => filters.every(([c, v]) => r[c] === v)) || null, error: null })
      };
      return q;
    },
    rpc: vi.fn(async (fn, { p_kind, p_release }) => {
      if (p_release) { delete sent[p_kind]; return { data: true, error: null }; }
      if (sent[p_kind]) return { data: false, error: null };
      sent[p_kind] = true;
      return { data: true, error: null };
    })
  };
}

const fakeResend = (error = null) => ({ emails: { send: vi.fn(async () => ({ data: { id: 'm1' }, error })) } });

const baseOrder = (overrides = {}) => ({
  id: ORDER, store_id: 'velas', customer_email: 'ana@mail.com', customer_name: 'Ana',
  payment_method: 'Transferencia', status: 'reservado', created_at: new Date().toISOString(),
  total: 1000, shipping_cost: 0, items: [{ name: 'Vela', price: 1000, quantity: 1 }], ...overrides
});

describe('envío de los mails de la compra', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.STORE_EMAIL_SENDER = 'Ventas <ventas@vitrina.com>';
  });

  it('sin Resend configurado no manda nada (y no rompe)', async () => {
    delete process.env.RESEND_API_KEY;
    expect(await sendOrderEmail(fakeSupabase(baseOrder()), ORDER, 'received')).toEqual({ sent: false, reason: 'not_configured' });
  });

  it('pedido con transferencia: manda "recibimos tu pedido" una sola vez, con el nombre de la tienda y respuesta a la tienda', async () => {
    const db = fakeSupabase(baseOrder());
    const resend = fakeResend();
    expect(await sendOrderEmail(db, ORDER, 'received', { resend })).toEqual({ sent: true });
    expect(await sendOrderEmail(db, ORDER, 'received', { resend })).toEqual({ sent: false, reason: 'already_sent' });
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
    expect(resend.emails.send.mock.calls[0][0]).toMatchObject({
      from: 'Velas Luna <ventas@vitrina.com>', to: 'ana@mail.com', reply_to: 'hola@velas.com'
    });
  });

  it('el comprobante solo sale si la orden está pagada de verdad', async () => {
    const resend = fakeResend();
    expect(await sendOrderEmail(fakeSupabase(baseOrder()), ORDER, 'paid', { resend })).toEqual({ sent: false, reason: 'not_applicable' });
    expect(await sendOrderEmail(fakeSupabase(baseOrder({ status: 'pagado' })), ORDER, 'paid', { resend })).toEqual({ sent: true });
    // "Recibimos tu pedido" no aplica a MercadoPago ni a órdenes ya pagadas
    expect((await sendOrderEmail(fakeSupabase(baseOrder({ payment_method: 'MercadoPago' })), ORDER, 'received', { resend })).sent).toBe(false);
    expect((await sendOrderEmail(fakeSupabase(baseOrder({ status: 'pagado' })), ORDER, 'received', { resend })).sent).toBe(false);
  });

  it('si el envío falla, se libera para poder reintentar', async () => {
    const db = fakeSupabase(baseOrder({ status: 'pagado' }));
    expect(await sendOrderEmail(db, ORDER, 'paid', { resend: fakeResend({ message: 'caído' }) })).toEqual({ sent: false, reason: 'send_failed' });
    expect(await sendOrderEmail(db, ORDER, 'paid', { resend: fakeResend() })).toEqual({ sent: true });
  });

  it('remitente y link de seguimiento', () => {
    expect(fromHeader('Velas "Luna" <x>', 'ventas@vitrina.com')).toBe('Velas Luna x <ventas@vitrina.com>');
    expect(trackingUrlFor({ slug: 'velas', custom_domain: 'velas.com' }, {})).toBe('https://velas.com/seguimiento');
    expect(trackingUrlFor({ slug: 'velas' }, { STORES_ORIGIN: 'https://tiendas.app' })).toBe('https://tiendas.app/seguimiento?tienda=velas');
  });
});
