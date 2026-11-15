import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeJwt, keyOf, asToken } from './testJwt';

// La función del servidor se prueba con un Supabase falso: lo importante son los controles
// de acceso (solo admins) y que nunca se pueda desactivar a un administrador.
const fake = vi.hoisted(() => ({ client: null }));
vi.mock('../api/_lib/payments.js', () => ({
  hasServiceKey: () => true,
  getSupabase: () => fake.client
}));

const { default: handler } = await import('../api/admin-users.js');

const MINIMAL = '00000000-0000-0000-0000-000000000001';
const accounts = {
  admin: { id: 'admin', email: 'admin@x.com', app_metadata: { role: 'admin' } },
  client: { id: 'client', email: 'cliente@x.com', app_metadata: {} },
  socia: { id: 'socia', email: 'socia@x.com', app_metadata: {} }
};

// Base falsa con tablas: select/eq/in/delete encadenables, y storage con carpetas por tienda
function makeTables() {
  return {
    stores: [{ id: MINIMAL, slug: 'minimal', name: 'MINIMAL.' }, { id: 'velas', slug: 'velas', name: 'Velas' }, { id: 'comun', slug: 'comun', name: 'Compartida' }],
    store_members: [
      { store_id: MINIMAL, user_id: 'client', role: 'owner' },
      { store_id: 'velas', user_id: 'client', role: 'owner' },
      { store_id: 'comun', user_id: 'client', role: 'owner' },
      { store_id: 'comun', user_id: 'socia', role: 'owner' }
    ],
    products: [{ id: 'p1', store_id: 'velas' }, { id: 'p2', store_id: 'comun' }],
    orders: [{ id: 'o1', store_id: 'velas', user_id: null, customer_email: 'x@x.com', status: 'pagado', total: 10 }, { id: 'o2', store_id: 'comun', status: 'pagado', total: 5 }],
    inventory_logs: [{ id: 'l1', store_id: 'velas' }],
    favorites: [{ id: 'f1', store_id: 'velas', user_id: 'otro' }, { id: 'f2', store_id: 'comun', user_id: 'client' }],
    store_settings: [{ store_id: 'velas' }, { store_id: 'comun' }]
  };
}

function query(tables, table) {
  const filters = [];
  let op = 'select';
  const rows = () => (tables[table] || []).filter(r => filters.every(f => f(r)));
  const q = {
    select: () => q,
    eq: (col, val) => { filters.push(r => r[col] === val); return q; },
    in: (col, vals) => { filters.push(r => vals.includes(r[col])); return q; },
    delete: () => { op = 'delete'; return q; },
    then: (resolve) => {
      if (op === 'delete') {
        const gone = rows();
        tables[table] = (tables[table] || []).filter(r => !gone.includes(r));
        // Como en la base: al borrar una tienda se van sus dueños
        if (table === 'stores') tables.store_members = tables.store_members.filter(m => !gone.some(st => st.id === m.store_id));
        return resolve({ data: gone, error: null });
      }
      return resolve({ data: rows(), error: null });
    }
  };
  return q;
}

function makeClient() {
  const tables = makeTables();
  const files = { images: ['velas/products/a.webp', 'velas/branding/logo.png', 'comun/products/b.webp'], products: ['velas/banners/x.jpg'] };
  return {
    tables, files,
    storage: {
      from: (bucket) => ({
        list: async (prefix) => {
          const inside = files[bucket].filter(f => f.startsWith(prefix + '/')).map(f => f.slice(prefix.length + 1));
          const names = [...new Set(inside.map(p => p.split('/')[0]))];
          return { data: names.map(n => ({ name: n, id: inside.includes(n) ? 'file' : null })), error: null };
        },
        remove: async (paths) => { files[bucket] = files[bucket].filter(f => !paths.includes(f)); return { error: null }; }
      })
    },
    auth: {
      getUser: vi.fn(async (token) => ({ data: { user: accounts[keyOf(token)] || null }, error: accounts[keyOf(token)] ? null : new Error('bad') })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: Object.values(accounts) }, error: null })),
        getUserById: vi.fn(async (id) => ({ data: { user: accounts[id] || null }, error: null })),
        updateUserById: vi.fn(async () => ({ error: null })),
        deleteUser: vi.fn(async () => ({ error: null }))
      }
    },
    from: (table) => query(tables, table)
  };
}

function call({ token, method = 'GET', body }) {
  const req = { method, body, headers: { authorization: token ? `Bearer ${asToken(token)}` : '', host: 'tienda.test' } };
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  return handler(req, res).then(() => res);
}

describe('api/admin-users', () => {
  beforeEach(() => { fake.client = makeClient(); });

  it('rechaza pedidos sin sesión o de cuentas que no son admin', async () => {
    expect((await call({})).statusCode).toBe(401);
    expect((await call({ token: 'client' })).statusCode).toBe(401);
    expect(fake.client.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it('al admin con solo la contraseña (sin el código del celular) no lo deja entrar', async () => {
    expect((await call({ token: fakeJwt('admin', 'aal1') })).statusCode).toBe(401);
  });

  it('le lista los usuarios al admin', async () => {
    const res = await call({ token: 'admin' });
    expect(res.statusCode).toBe(200);
    expect(res.body.users.map(u => u.email).sort()).toEqual(['admin@x.com', 'cliente@x.com', 'socia@x.com']);
  });

  it('desactiva y reactiva clientes', async () => {
    const off = await call({ token: 'admin', method: 'POST', body: { action: 'disable', userId: 'client' } });
    expect(off.statusCode).toBe(200);
    expect(fake.client.auth.admin.updateUserById).toHaveBeenLastCalledWith('client', { ban_duration: '876000h' });

    await call({ token: 'admin', method: 'POST', body: { action: 'enable', userId: 'client' } });
    expect(fake.client.auth.admin.updateUserById).toHaveBeenLastCalledWith('client', { ban_duration: 'none' });
  });

  it('no deja desactivar administradores', async () => {
    const res = await call({ token: 'admin', method: 'POST', body: { action: 'disable', userId: 'admin' } });
    expect(res.statusCode).toBe(403);
    expect(fake.client.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('manda el mail de restablecimiento al email de la cuenta', async () => {
    const res = await call({ token: 'admin', method: 'POST', body: { action: 'reset', userId: 'client' } });
    expect(res.statusCode).toBe(200);
    expect(fake.client.auth.resetPasswordForEmail).toHaveBeenCalledWith('cliente@x.com', { redirectTo: 'https://tienda.test/perfil?tab=datos' });
  });

  it('rechaza acciones desconocidas', async () => {
    const res = await call({ token: 'admin', method: 'POST', body: { action: 'delete', userId: 'client' } });
    expect(res.statusCode).toBe(400);
  });

  describe('borrado definitivo (herramienta temporal)', () => {
    const purge = (userId, confirmEmail) => call({ token: 'admin', method: 'POST', body: { action: 'purge', userId, confirmEmail } });

    it('el listado muestra las tiendas de cada cuenta y si el borrado está prendido', async () => {
      const res = await call({ token: 'admin' });
      expect(res.body.hardDeleteEnabled).toBe(true);
      const client = res.body.users.find(u => u.id === 'client');
      expect(client.stores.map(st => [st.slug, st.shared, st.protected])).toEqual(
        expect.arrayContaining([['velas', false, false], ['comun', true, false], ['minimal', false, true]])
      );
    });

    it('sin escribir el email exacto no borra nada', async () => {
      expect((await purge('client', 'otro@x.com')).statusCode).toBe(400);
      expect(fake.client.auth.admin.deleteUser).not.toHaveBeenCalled();
      expect(fake.client.tables.stores).toHaveLength(3);
    });

    it('borra la cuenta y su tienda con todo; la compartida queda y MINIMAL nunca se toca', async () => {
      const res = await purge('client', ' Cliente@X.com ');
      expect(res.statusCode).toBe(200);
      expect(fake.client.auth.admin.deleteUser).toHaveBeenCalledWith('client');
      const t = fake.client.tables;
      expect(t.stores.map(st => st.slug).sort()).toEqual(['comun', 'minimal']);
      expect(t.products.map(p => p.id)).toEqual(['p2']);
      expect(t.orders.map(o => o.id)).toEqual(['o2']);
      expect(t.inventory_logs).toHaveLength(0);
      expect(t.favorites).toHaveLength(0); // los de la tienda borrada y los de la cuenta
      expect(t.store_settings.map(x => x.store_id)).toEqual(['comun']);
      // Fotos de la tienda borrada, sí; las de la compartida, no
      expect(fake.client.files.images).toEqual(['comun/products/b.webp']);
      expect(fake.client.files.products).toEqual([]);
      expect(res.body.deletedStores.map(st => st.slug)).toEqual(['velas']);
      expect(res.body.keptStores.map(st => st.slug)).toEqual(['comun']);
    });

    it('no deja borrar administradores', async () => {
      expect((await purge('admin', 'admin@x.com')).statusCode).toBe(403);
      expect(fake.client.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it('con DISABLE_HARD_DELETE=true queda apagado', async () => {
      process.env.DISABLE_HARD_DELETE = 'true';
      try {
        expect((await call({ token: 'admin' })).body.hardDeleteEnabled).toBe(false);
        expect((await purge('client', 'cliente@x.com')).statusCode).toBe(403);
        expect(fake.client.auth.admin.deleteUser).not.toHaveBeenCalled();
      } finally {
        delete process.env.DISABLE_HARD_DELETE;
      }
    });
  });
});
