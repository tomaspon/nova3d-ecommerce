import { describe, it, expect, vi, beforeEach } from 'vitest';

// La función del servidor se prueba con un Supabase falso: lo importante son los controles
// de acceso (solo admins) y que nunca se pueda desactivar a un administrador.
const fake = vi.hoisted(() => ({ client: null }));
vi.mock('../api/_lib/payments.js', () => ({
  hasServiceKey: () => true,
  getSupabase: () => fake.client
}));

const { default: handler } = await import('../api/admin-users.js');

const accounts = {
  admin: { id: 'admin', email: 'admin@x.com', app_metadata: { role: 'admin' } },
  client: { id: 'client', email: 'cliente@x.com', app_metadata: {} }
};

function makeClient() {
  return {
    auth: {
      getUser: vi.fn(async (token) => ({ data: { user: accounts[token] || null }, error: accounts[token] ? null : new Error('bad') })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: Object.values(accounts) }, error: null })),
        getUserById: vi.fn(async (id) => ({ data: { user: accounts[id] || null }, error: null })),
        updateUserById: vi.fn(async () => ({ error: null }))
      }
    },
    from: () => ({ select: async () => ({ data: [], error: null }) })
  };
}

function call({ token, method = 'GET', body }) {
  const req = { method, body, headers: { authorization: token ? `Bearer ${token}` : '', host: 'tienda.test' } };
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

  it('le lista los usuarios al admin', async () => {
    const res = await call({ token: 'admin' });
    expect(res.statusCode).toBe(200);
    expect(res.body.users.map(u => u.email).sort()).toEqual(['admin@x.com', 'cliente@x.com']);
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
});
