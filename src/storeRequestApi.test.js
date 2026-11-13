import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TERMS_VERSION } from './storeRequest';

// api/store-request.js con un Supabase falso que guarda las filas en memoria
const fake = vi.hoisted(() => ({ rows: [] }));
vi.mock('../api/_lib/payments.js', () => ({
  hasServiceKey: () => true,
  getSupabase: () => ({
    from: () => {
      const filters = [];
      const builder = {
        select: () => builder,
        eq: (k, v) => { filters.push(r => r[k] === v); return builder; },
        gte: (k, v) => { filters.push(r => r[k] >= v); return builder; },
        insert: async (row) => { fake.rows.push({ ...row, created_at: new Date().toISOString() }); return { error: null }; },
        then: (resolve) => resolve({ count: fake.rows.filter(r => filters.every(f => f(r))).length, error: null })
      };
      return builder;
    }
  })
}));

const { default: handler } = await import('../api/store-request.js');

const form = {
  owner_name: 'Ana Pérez', tax_id: '20-12345678-6', email: 'ana@mail.com', phone: '2915551234',
  city: 'Bahía Blanca', province: 'Buenos Aires', business_name: 'Velas Luna', category: 'velas',
  accepted_terms: true, terms_version: TERMS_VERSION
};

function send(body, ip = '200.1.1.1') {
  const req = { method: 'POST', body, headers: { 'x-forwarded-for': `${ip}, 10.0.0.1`, 'user-agent': 'Test' } };
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; return this; } };
  return handler(req, res).then(() => res);
}

describe('api/store-request', () => {
  beforeEach(() => { fake.rows = []; });

  it('guarda la solicitud con la prueba del consentimiento', async () => {
    const res = await send(form);
    expect(res.statusCode).toBe(200);
    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0]).toMatchObject({ tax_id: '20123456786', terms_version: TERMS_VERSION, ip: '200.1.1.1', user_agent: 'Test' });
    expect(fake.rows[0].accepted_at).toBeTruthy();
  });

  it('rechaza datos inválidos o sin aceptar los términos, sin guardar', async () => {
    const res = await send({ ...form, tax_id: '123', accepted_terms: false });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['tax_id', 'accepted_terms']));
    expect(fake.rows).toHaveLength(0);
  });

  it('a los bots (campo trampa completo) les responde ok pero no guarda', async () => {
    const res = await send({ ...form, website: 'http://spam' });
    expect(res.statusCode).toBe(200);
    expect(fake.rows).toHaveLength(0);
  });

  it('limita los envíos repetidos desde la misma IP', async () => {
    for (let i = 0; i < 3; i++) expect((await send(form)).statusCode).toBe(200);
    expect((await send(form)).statusCode).toBe(429);
    expect((await send(form, '200.9.9.9')).statusCode).toBe(200);
  });
});
