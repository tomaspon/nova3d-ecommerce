import { describe, it, expect, vi, beforeEach } from 'vitest';

// La función del panel de plataforma con un Supabase falso en memoria.
const fake = vi.hoisted(() => ({ client: null }));
vi.mock('../api/_lib/payments.js', () => ({
  hasServiceKey: () => true,
  getSupabase: () => fake.client
}));

const { default: handler } = await import('../api/platform-stores.js');

const MINIMAL = '00000000-0000-0000-0000-000000000001';
const users = {
  admin: { id: 'u-admin', email: 'admin@x.com', app_metadata: { role: 'admin' } },
  owner: { id: 'u-owner', email: 'duena@velas.com', app_metadata: {} }
};

// Constructor de consultas mínimo: filtra por eq y aplica insert/update/delete/upsert
function makeClient() {
  const tables = {
    stores: [{ id: MINIMAL, slug: 'minimal', name: 'MINIMAL.', status: 'active', custom_domain: null, template: 'ropa', created_at: '1' }],
    store_settings: [],
    store_members: [],
    products: [],
    orders: []
  };
  let nextId = 1;

  function query(table) {
    const filters = [];
    let op = 'select', payload = null, conflict = null;
    const matches = (row) => filters.every(([k, v]) => row[k] === v);
    const exec = () => {
      const rows = tables[table];
      if (op === 'insert') {
        const row = { id: `id-${nextId++}`, created_at: String(nextId), status: 'active', custom_domain: null, ...payload };
        if (table === 'stores' && rows.some(r => r.slug === row.slug)) return { data: null, error: { code: '23505' } };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (op === 'upsert') {
        const keys = conflict.split(',');
        const existing = rows.find(r => keys.every(k => r[k] === payload[k]));
        if (existing) Object.assign(existing, payload); else rows.push({ ...payload });
        return { data: [payload], error: null };
      }
      if (op === 'update') {
        if (table === 'stores' && payload.custom_domain && rows.some(r => r.custom_domain === payload.custom_domain && !matches(r))) {
          return { data: null, error: { code: '23505' } };
        }
        rows.filter(matches).forEach(r => Object.assign(r, payload));
        return { data: rows.filter(matches), error: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter(r => !matches(r));
        return { data: [], error: null };
      }
      return { data: rows.filter(matches), error: null };
    };
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (k, v) => { filters.push([k, v]); return builder; },
      insert: (p) => { op = 'insert'; payload = p; return builder; },
      update: (p) => { op = 'update'; payload = p; return builder; },
      upsert: (p, o) => { op = 'upsert'; payload = p; conflict = o.onConflict; return builder; },
      delete: () => { op = 'delete'; return builder; },
      single: async () => { const r = exec(); return { data: r.data?.[0] ?? null, error: r.error }; },
      maybeSingle: async () => { const r = exec(); return { data: r.data?.[0] ?? null, error: r.error }; },
      then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject)
    };
    return builder;
  }

  return {
    tables,
    from: query,
    auth: {
      getUser: async (token) => ({ data: { user: users[token] || null }, error: users[token] ? null : new Error('x') }),
      admin: {
        listUsers: async () => ({ data: { users: Object.values(users) }, error: null }),
        getUserById: async (id) => ({ data: { user: Object.values(users).find(u => u.id === id) || null } }),
        inviteUserByEmail: vi.fn(async (email) => ({ data: { user: { id: 'u-new', email } }, error: null }))
      }
    }
  };
}

function call(token, body) {
  const req = { method: body ? 'POST' : 'GET', body, headers: { authorization: token ? `Bearer ${token}` : '', host: 'tienda.test' } };
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; return this; } };
  return handler(req, res).then(() => res);
}

describe('api/platform-stores', () => {
  beforeEach(() => { fake.client = makeClient(); });

  it('solo entra el administrador de la plataforma', async () => {
    expect((await call(null)).statusCode).toBe(401);
    expect((await call('owner')).statusCode).toBe(401);
    const res = await call('admin');
    expect(res.statusCode).toBe(200);
    expect(res.body.stores[0]).toMatchObject({ slug: 'minimal', isDefault: true, productCount: 0 });
  });

  it('crea la tienda con su configuración y su dueño', async () => {
    const res = await call('admin', { action: 'create', name: 'Velas Luna', slug: 'velas-luna', template: 'velas', ownerEmail: 'duena@velas.com' });
    expect(res.statusCode).toBe(200);
    const store = fake.client.tables.stores.find(s => s.slug === 'velas-luna');
    expect(store).toMatchObject({ name: 'Velas Luna', template: 'velas' });
    expect(fake.client.tables.store_settings).toHaveLength(1);
    expect(fake.client.tables.store_settings[0]).toMatchObject({ store_id: store.id, store_name: 'Velas Luna' });
    expect(fake.client.tables.store_members).toEqual([{ store_id: store.id, user_id: 'u-owner', role: 'owner' }]);
  });

  it('con plantilla copia la configuración de otra tienda, pero no sus productos', async () => {
    const t = fake.client.tables;
    t.store_settings.push({ store_id: MINIMAL, store_name: 'MINIMAL.', shipping_cost: 1500, campaign_active: true, campaign_name: 'Summer Sale', campaign_image_url: 'preset:verano' });
    t.products.push({ id: 'p1', store_id: MINIMAL, is_active: true });
    t.stores[0].branding = { color: '#000' };

    const res = await call('admin', { action: 'create', name: 'Velas', slug: 'velas', copyFrom: MINIMAL });
    expect(res.body.message).toMatch(/configuración de MINIMAL/);
    const velas = t.stores.find(s => s.slug === 'velas');
    expect(velas.branding).toEqual({ color: '#000' });
    expect(t.store_settings.find(s => s.store_id === velas.id)).toMatchObject({
      store_name: 'Velas', shipping_cost: 1500, campaign_active: true, campaign_name: 'Summer Sale', campaign_image_url: 'preset:verano'
    });
    expect(t.products.filter(p => p.store_id === velas.id)).toHaveLength(0);
  });

  it('invita por mail a un dueño que todavía no tiene cuenta', async () => {
    const res = await call('admin', { action: 'create', name: 'Velas', slug: 'velas', ownerEmail: 'nuevo@velas.com' });
    expect(res.body.message).toMatch(/Invitamos/);
    expect(fake.client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('nuevo@velas.com', { redirectTo: 'https://tienda.test/admin?tienda=velas' });
  });

  it('rechaza enlaces inválidos, reservados o repetidos', async () => {
    expect((await call('admin', { action: 'create', name: 'X', slug: 'Velas Luna' })).statusCode).toBe(400);
    expect((await call('admin', { action: 'create', name: 'X', slug: 'admin' })).statusCode).toBe(400);
    expect((await call('admin', { action: 'create', name: 'X', slug: 'minimal' })).statusCode).toBe(409);
  });

  it('no deja suspender la tienda principal; las demás sí', async () => {
    expect((await call('admin', { action: 'update', storeId: MINIMAL, status: 'suspended' })).statusCode).toBe(400);
    await call('admin', { action: 'create', name: 'Velas', slug: 'velas' });
    const velas = fake.client.tables.stores.find(s => s.slug === 'velas');
    expect((await call('admin', { action: 'update', storeId: velas.id, status: 'suspended' })).statusCode).toBe(200);
    expect(velas.status).toBe('suspended');
  });

  it('guarda dominios limpios, rechaza inválidos y no repite el de otra tienda', async () => {
    expect((await call('admin', { action: 'setDomain', storeId: MINIMAL, domain: 'https://www.Minimal.com.ar/' })).statusCode).toBe(200);
    expect(fake.client.tables.stores[0].custom_domain).toBe('minimal.com.ar');

    expect((await call('admin', { action: 'setDomain', storeId: MINIMAL, domain: 'no es un dominio' })).statusCode).toBe(400);

    await call('admin', { action: 'create', name: 'Velas', slug: 'velas' });
    const velas = fake.client.tables.stores.find(s => s.slug === 'velas');
    expect((await call('admin', { action: 'setDomain', storeId: velas.id, domain: 'minimal.com.ar' })).statusCode).toBe(409);

    expect((await call('admin', { action: 'setDomain', storeId: MINIMAL, domain: '' })).statusCode).toBe(200);
    expect(fake.client.tables.stores[0].custom_domain).toBeNull();
  });

  it('agrega y quita dueños', async () => {
    await call('admin', { action: 'addOwner', storeId: MINIMAL, email: 'DUENA@velas.com' });
    expect(fake.client.tables.store_members).toHaveLength(1);
    await call('admin', { action: 'removeOwner', storeId: MINIMAL, userId: 'u-owner' });
    expect(fake.client.tables.store_members).toHaveLength(0);
  });
});
