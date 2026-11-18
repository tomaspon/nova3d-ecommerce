import { describe, it, expect, vi, beforeEach } from 'vitest';
import { keyOf, asToken } from './testJwt';
import { TERMS_VERSION } from './storeSignup';

// api/store-signup.js con un Supabase falso en memoria
const fake = vi.hoisted(() => ({ client: null }));
vi.mock('../api/_lib/payments.js', () => ({ hasServiceKey: () => true, getSupabase: () => fake.client }));

const { default: handler } = await import('../api/store-signup.js');

const users = {
  ana: { id: 'u-ana', email: 'ana@x.com', app_metadata: {} },
  admin: { id: 'u-admin', email: 'admin@x.com', app_metadata: { role: 'admin' } }
};

function makeClient() {
  const tables = { stores: [{ id: 'minimal', slug: 'minimal', created_by: null, signup_ip: null, created_at: '2020-01-01' }], store_settings: [], store_members: [], store_owner_details: [] };
  let nextId = 1;
  const from = (table) => {
    const filters = [];
    let op = 'select', payload = null, head = false;
    const failInsert = tables.failInsert;
    const matches = (r) => filters.every(f => f(r));
    const exec = () => {
      const rows = tables[table];
      if (op === 'insert' && failInsert === table) return { data: null, error: { code: '23505', message: 'duplicate key' } };
      if (op === 'insert') {
        const row = { id: `id-${nextId++}`, created_at: new Date().toISOString(), ...payload };
        if (table === 'stores' && rows.some(r => r.slug === row.slug)) return { data: null, error: { code: '23505' } };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (op === 'update') { rows.filter(matches).forEach(r => Object.assign(r, payload)); return { data: [], error: null }; }
      if (op === 'delete') { tables[table] = rows.filter(r => !matches(r)); return { data: [], error: null }; }
      const found = rows.filter(matches);
      return head ? { count: found.length, error: null } : { data: found, error: null };
    };
    const b = {
      select: (_cols, opts) => { if (opts?.head) head = true; return b; },
      eq: (k, v) => { filters.push(r => r[k] === v); return b; },
      gte: (k, v) => { filters.push(r => r[k] >= v); return b; },
      insert: (p) => { op = 'insert'; payload = p; return b; },
      update: (p) => { op = 'update'; payload = p; return b; },
      delete: () => { op = 'delete'; return b; },
      single: async () => { const r = exec(); return { data: r.data?.[0] ?? null, error: r.error }; },
      maybeSingle: async () => { const r = exec(); return { data: r.data?.[0] ?? null, error: r.error }; },
      then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject)
    };
    return b;
  };
  return {
    tables,
    from,
    auth: { getUser: async (t) => ({ data: { user: users[keyOf(t)] || null }, error: users[keyOf(t)] ? null : new Error('x') }) }
  };
}

const valid = { action: 'create', name: 'Velas Luna', slug: 'velas-luna', template: 'velas', tax_id: '20-12345678-6', whatsapp: '11 2345-6789', sales_channels: ['instagram', 'otra-cosa'], accepted_terms: true, terms_version: TERMS_VERSION };

function call(token, body, ip = '200.1.1.1') {
  const req = { method: 'POST', body, headers: { authorization: token ? `Bearer ${asToken(token)}` : '', 'x-forwarded-for': ip } };
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; return this; } };
  return handler(req, res).then(() => res);
}

describe('api/store-signup', () => {
  beforeEach(() => { fake.client = makeClient(); });

  it('sin sesión no se puede crear una tienda', async () => {
    expect((await call(null, valid)).statusCode).toBe(401);
  });

  it('valida los datos y que acepte los términos', async () => {
    const res = await call('ana', { ...valid, slug: 'admin', accepted_terms: false, tax_id: '20-12345678-5', whatsapp: '123' });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['accepted_terms', 'slug', 'tax_id', 'whatsapp']);
  });

  it('crea la tienda sin ventas habilitadas, con su configuración, su dueño y el consentimiento', async () => {
    const res = await call('ana', valid);
    expect(res.statusCode).toBe(200);
    const store = fake.client.tables.stores.find(s => s.slug === 'velas-luna');
    expect(store).toMatchObject({ sales_enabled: false, created_by: 'u-ana', terms_version: TERMS_VERSION, signup_ip: '200.1.1.1' });
    expect(fake.client.tables.store_settings[0]).toMatchObject({ store_id: store.id, store_name: 'Velas Luna' });
    expect(fake.client.tables.store_members[0]).toMatchObject({ store_id: store.id, user_id: 'u-ana', role: 'owner' });
    // CUIL/CUIT y WhatsApp solo con números; de los canales, solo los conocidos
    expect(fake.client.tables.store_owner_details[0]).toMatchObject({ store_id: store.id, tax_id: '20123456786', whatsapp: '1123456789', sales_channels: ['instagram'] });
  });

  it('una tienda por cuenta y enlaces únicos', async () => {
    await call('ana', valid);
    expect((await call('ana', { ...valid, slug: 'otra' })).statusCode).toBe(409);
    expect((await call('admin', { ...valid })).statusCode).toBe(409); // el enlace ya existe
    expect((await call('admin', { ...valid, slug: 'otra-mas' })).statusCode).toBe(200); // la plataforma no tiene límite
  });

  it('si falla un paso, la tienda se deshace y no queda a medias', async () => {
    fake.client.tables.failInsert = 'store_settings';
    expect((await call('ana', valid)).statusCode).toBe(500);
    expect(fake.client.tables.stores.some(s => s.slug === 'velas-luna')).toBe(false);
    // Y se puede volver a intentar con el mismo enlace
    fake.client.tables.failInsert = null;
    expect((await call('ana', valid)).statusCode).toBe(200);
  });

  it('pide la activación solo quien administra la tienda', async () => {
    await call('ana', valid);
    const store = fake.client.tables.stores.find(s => s.slug === 'velas-luna');
    expect((await call('admin', { action: 'requestActivation', storeId: store.id })).statusCode).toBe(403);
    expect((await call('ana', { action: 'requestActivation', storeId: store.id })).statusCode).toBe(200);
    expect(store.activation_requested_at).toBeTruthy();
  });
});
