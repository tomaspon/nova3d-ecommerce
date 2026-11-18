import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Conexión de MercadoPago por tienda: cifrado, state firmado, OAuth, cobro y verificación de pagos.
process.env.MP_TOKENS_KEY = crypto.randomBytes(32).toString('base64');
process.env.MP_APP_ID = '123456';
process.env.MP_CLIENT_SECRET = 'secreto-app';
process.env.MP_REDIRECT_URI = 'https://plataforma.test/api/mp-callback';
process.env.MP_ACCESS_TOKEN = 'TOKEN-PLATAFORMA';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';

const MINIMAL = '00000000-0000-0000-0000-000000000001';
const fake = vi.hoisted(() => ({ client: null, payment: null, preferences: [] }));

vi.mock('../api/_lib/payments.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, hasServiceKey: () => true, getSupabase: () => fake.client };
});
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class { constructor(opts) { this.accessToken = opts.accessToken; } },
  Payment: class {
    constructor(client) { this.client = client; }
    async get() { return { ...fake.payment, _token: this.client.accessToken }; }
  },
  Preference: class {
    constructor(client) { this.client = client; }
    async create({ body }) { fake.preferences.push({ body, token: this.client.accessToken }); return { init_point: 'https://mp/pagar', id: 'pref' }; }
  }
}));

const { encryptSecret, decryptSecret, signState, verifyState } = await import('../api/_lib/secrets.js');
const { default: connect } = await import('../api/mp-connect.js');
const { default: callback } = await import('../api/mp-callback.js');
const { default: checkout } = await import('../api/checkout.js');
const { processPayment } = await import('../api/_lib/payments.js');

const users = {
  duena: { id: 'u-duena', app_metadata: {} },
  otro: { id: 'u-otro', app_metadata: {} }
};

function makeClient() {
  const tables = {
    stores: [
      { id: MINIMAL, slug: 'minimal', custom_domain: null, mp_connected: false },
      { id: 'velas', slug: 'velas', custom_domain: null, mp_connected: false }
    ],
    store_members: [{ store_id: 'velas', user_id: 'u-duena', role: 'owner' }],
    store_payment_accounts: [],
    orders: [
      { id: 'orden-velas', store_id: 'velas', status: 'reservado', total: 1000, shipping_cost: 0, items: [{ id: 'p', name: 'Vela', quantity: 1, unit_price: 1000 }] },
      { id: 'orden-minimal', store_id: MINIMAL, status: 'reservado', total: 500, shipping_cost: 0, items: [{ id: 'q', name: 'Remera', quantity: 1, unit_price: 500 }] }
    ]
  };
  const from = (table) => {
    const filters = [];
    let op = 'select', payload = null, conflict = null;
    const matches = (r) => filters.every(([k, v]) => r[k] === v);
    const exec = () => {
      const rows = tables[table];
      if (op === 'upsert') {
        const existing = rows.find(r => r[conflict] === payload[conflict]);
        if (existing) Object.assign(existing, payload); else rows.push({ ...payload });
        return { data: [payload], error: null };
      }
      if (op === 'update') { rows.filter(matches).forEach(r => Object.assign(r, payload)); return { data: [], error: null }; }
      if (op === 'delete') { tables[table] = rows.filter(r => !matches(r)); return { data: [], error: null }; }
      return { data: rows.filter(matches), error: null };
    };
    const b = {
      select: () => b,
      eq: (k, v) => { filters.push([k, v]); return b; },
      upsert: (p, o) => { op = 'upsert'; payload = p; conflict = o.onConflict; return b; },
      update: (p) => { op = 'update'; payload = p; return b; },
      delete: () => { op = 'delete'; return b; },
      single: async () => { const r = exec(); return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: 'no rows' } }; },
      maybeSingle: async () => { const r = exec(); return { data: r.data[0] ?? null, error: null }; },
      then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject)
    };
    return b;
  };
  return {
    tables,
    from,
    rpc: vi.fn(async () => ({ data: 'pagado', error: null })),
    auth: { getUser: async (t) => ({ data: { user: users[t] || null }, error: users[t] ? null : new Error('x') }) }
  };
}

const response = () => ({
  statusCode: 0, body: null, location: null,
  status(c) { this.statusCode = c; return this; },
  json(d) { this.body = d; return this; },
  redirect(c, url) { this.statusCode = c; this.location = url; return this; }
});

beforeEach(() => {
  fake.client = makeClient();
  fake.preferences = [];
  vi.unstubAllGlobals();
});

describe('cifrado y state', () => {
  it('los tokens se guardan cifrados y no se pueden alterar', () => {
    const packed = encryptSecret('APP_USR-secreto');
    expect(packed).not.toContain('secreto');
    expect(decryptSecret(packed)).toBe('APP_USR-secreto');
    const [v, iv, tag, data] = packed.split('.');
    const altered = [v, iv, tag, Buffer.from('otra cosa').toString('base64url')].join('.');
    expect(() => decryptSecret(altered)).toThrow();
  });

  it('el state firmado no se puede falsificar ni usar vencido', () => {
    const state = signState({ s: 'velas', u: 'u-duena' });
    expect(verifyState(state)).toMatchObject({ s: 'velas', u: 'u-duena' });
    const [body, sig] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), s: 'minimal' })).toString('base64url');
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
    expect(verifyState(signState({ s: 'velas' }, -1))).toBeNull();
  });
});

describe('api/mp-connect', () => {
  const call = (token, body) => {
    const res = response();
    return connect({ method: 'POST', body, headers: { authorization: `Bearer ${token}` } }, res).then(() => res);
  };

  it('solo quien administra la tienda puede conectarla', async () => {
    expect((await call('otro', { action: 'start', storeId: 'velas' })).statusCode).toBe(403);
    const res = await call('duena', { action: 'start', storeId: 'velas' });
    const url = new URL(res.body.url);
    expect(url.origin + url.pathname).toBe('https://auth.mercadopago.com/authorization');
    expect(url.searchParams.get('client_id')).toBe('123456');
    expect(url.searchParams.get('redirect_uri')).toBe('https://plataforma.test/api/mp-callback');
    expect(verifyState(url.searchParams.get('state'))).toMatchObject({ s: 'velas', u: 'u-duena' });
  });
});

describe('api/mp-callback', () => {
  const call = (query) => {
    const res = response();
    return callback({ method: 'GET', query, headers: { host: 'plataforma.test' } }, res).then(() => res);
  };

  it('con un state inválido no conecta nada', async () => {
    const res = await call({ code: 'abc', state: 'trucho' });
    expect(res.location).toContain('mp=invalido');
    expect(fake.client.tables.store_payment_accounts).toHaveLength(0);
  });

  it('canjea el código y guarda la cuenta cifrada', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'APP_USR-vendedor', refresh_token: 'TG-refresh', user_id: 777, expires_in: 15552000, public_key: 'APP_USR-pk', live_mode: true })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await call({ code: 'TG-code', state: signState({ s: 'velas', u: 'u-duena' }) });
    expect(res.location).toBe('https://plataforma.test/panel/velas/configuracion?mp=conectado');

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ grant_type: 'authorization_code', code: 'TG-code', client_id: '123456', redirect_uri: 'https://plataforma.test/api/mp-callback' });

    const [account] = fake.client.tables.store_payment_accounts;
    expect(account.access_token_enc).not.toContain('APP_USR-vendedor');
    expect(decryptSecret(account.access_token_enc)).toBe('APP_USR-vendedor');
    expect(account).toMatchObject({ store_id: 'velas', mp_user_id: '777', connected_by: 'u-duena' });
    expect(fake.client.tables.stores.find(s => s.id === 'velas').mp_connected).toBe(true);
  });
});

describe('cobro y verificación con la cuenta de cada tienda', () => {
  const connectVelas = () => fake.client.tables.store_payment_accounts.push({
    store_id: 'velas', access_token_enc: encryptSecret('APP_USR-vendedor'), expires_at: new Date(Date.now() + 100 * 86400000).toISOString()
  });
  const pay = (orderId, origin = 'https://plataforma.test') => {
    const res = response();
    return checkout({ method: 'POST', body: { orderId }, headers: { origin, host: 'plataforma.test' } }, res).then(() => res);
  };

  it('una tienda sin MercadoPago conectado no puede cobrar con MercadoPago', async () => {
    expect((await pay('orden-velas')).statusCode).toBe(409);
  });

  it('cobra con la cuenta del vendedor, avisa con la tienda y suma la comisión', async () => {
    process.env.PLATFORM_FEE_PERCENT = '5';
    connectVelas();
    expect((await pay('orden-velas')).statusCode).toBe(200);
    const [pref] = fake.preferences;
    expect(pref.token).toBe('APP_USR-vendedor');
    expect(pref.body.notification_url).toBe('https://plataforma.test/api/webhook?store=velas');
    expect(pref.body.marketplace_fee).toBe(50);
    delete process.env.PLATFORM_FEE_PERCENT;
  });

  it('vuelve siempre a la tienda que cobra, aunque el pedido diga venir de otro sitio', async () => {
    connectVelas();
    expect((await pay('orden-velas', 'https://sitio-falso.com')).statusCode).toBe(200);
    expect(fake.preferences[0].body.back_urls.success).toMatch(/^https:\/\/plataforma\.test\/seguimiento\?order=orden-velas/);
  });

  it('la tienda principal sigue cobrando con la cuenta de la plataforma, sin comisión', async () => {
    process.env.PLATFORM_FEE_PERCENT = '5';
    expect((await pay('orden-minimal')).statusCode).toBe(200);
    expect(fake.preferences[0].token).toBe('TOKEN-PLATAFORMA');
    expect(fake.preferences[0].body.marketplace_fee).toBeUndefined();
    delete process.env.PLATFORM_FEE_PERCENT;
  });

  it('un pago de una tienda no puede marcar como pagada la orden de otra', async () => {
    connectVelas();
    fake.payment = { external_reference: 'orden-minimal', status: 'approved', transaction_amount: 500 };
    const result = await processPayment('99', 'velas', fake.client);
    expect(result.paymentStatus).toBe('store_mismatch');
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it('un pago aprobado de la misma tienda marca la orden, consultado con su cuenta', async () => {
    connectVelas();
    fake.payment = { external_reference: 'orden-velas', status: 'approved', transaction_amount: 1000 };
    const result = await processPayment('100', 'velas', fake.client);
    expect(result.orderStatus).toBe('pagado');
    expect(fake.client.rpc).toHaveBeenCalledWith('mark_order_paid', { p_order_id: 'orden-velas', p_paid_amount: 1000 });
  });
});
