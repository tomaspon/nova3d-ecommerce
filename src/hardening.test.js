import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('./supabaseClient', () => ({ supabase: { rpc: vi.fn(async () => ({})) }, authReturnTarget: undefined }));
vi.mock('../api/_lib/payments.js', () => ({ processPayment: vi.fn(), getSupabase: () => ({ rpc: async () => ({}) }), hasServiceKey: () => true }));

const { validMpSignature } = await import('../api/webhook.js');
const { buildOgHtml, robotsTxt, escapeHtml } = await import('../api/seo.js');
const { shouldReport } = await import('./errorReporter.js');
const { productJsonLd } = await import('./pageMeta.js');
const { accountExport } = await import('./components/AccountPrivacy.jsx');
const { trustedOrigin } = await import('../api/_lib/guard.js');

describe('firma del webhook de MercadoPago', () => {
  const secret = 'clave-secreta';
  const sign = (id, requestId, ts) => createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  const req = (v1, id = '123', ts = '1700000000') => ({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' }, query: { 'data.id': id }, body: {} });

  it('sin clave cargada no exige firma (compatibilidad)', () => {
    expect(validMpSignature(req('x'), '')).toBe(true);
  });
  it('acepta la firma correcta y rechaza la falsa o la ausente', () => {
    expect(validMpSignature(req(sign('123', 'req-1', '1700000000')), secret)).toBe(true);
    expect(validMpSignature(req(sign('999', 'req-1', '1700000000')), secret)).toBe(false);
    expect(validMpSignature({ headers: {}, query: {}, body: {} }, secret)).toBe(false);
  });
});

describe('origen de confianza para volver de MercadoPago', () => {
  it('solo la misma dirección (o local)', () => {
    expect(trustedOrigin({ headers: { origin: 'https://tienda.com', host: 'tienda.com' } })).toBe('https://tienda.com');
    expect(trustedOrigin({ headers: { origin: 'https://malo.com', host: 'tienda.com' } })).toBeNull();
    expect(trustedOrigin({ headers: { origin: 'http://localhost:5173', host: 'x.vercel.app' } })).toBe('http://localhost:5173');
    expect(trustedOrigin({ headers: { host: 'tienda.com' } })).toBeNull();
  });
});

describe('vista previa al compartir y robots', () => {
  it('escapa todo lo que viene de la tienda', () => {
    const html = buildOgHtml({ title: 'Remera "<script>"', description: 'a & b', url: 'https://t.com/', siteName: 'T', image: '' });
    expect(html).toContain('Remera &quot;&lt;script&gt;&quot;');
    expect(html).not.toContain('<script>');
    expect(escapeHtml(`'`)).toBe('&#39;');
  });
  it('robots.txt deja afuera paneles, cuentas y la API, y apunta al sitemap', () => {
    const txt = robotsTxt('https://t.com');
    expect(txt).toContain('Disallow: /panel');
    expect(txt).toContain('Disallow: /perfil');
    expect(txt).toContain('Sitemap: https://t.com/sitemap.xml');
  });
});

describe('errores que no vale la pena avisar', () => {
  it('ignora extensiones, cortes de conexión y ruido del navegador', () => {
    expect(shouldReport('TypeError: x is undefined')).toBe(true);
    expect(shouldReport('Failed to fetch')).toBe(false);
    expect(shouldReport('ResizeObserver loop completed with undelivered notifications.')).toBe(false);
    expect(shouldReport('boom', 'at chrome-extension://abc/x.js')).toBe(false);
    expect(shouldReport('')).toBe(false);
  });
});

describe('datos para Google', () => {
  it('ficha de producto con precio final, stock y moneda', () => {
    globalThis.window = { location: { origin: 'https://t.com' } };
    const ld = productJsonLd({ id: 'p1', name: 'Jean', price: 1000, discount: 10, imageUrl: '/demo/jean.svg', available_stock: 0 }, { name: 'MINIMAL.' }, 'https://t.com/producto/p1');
    expect(ld).toMatchObject({ '@type': 'Product', name: 'Jean', image: ['https://t.com/demo/jean.svg'] });
    expect(ld.offers).toMatchObject({ price: 900, priceCurrency: 'ARS', availability: 'https://schema.org/OutOfStock' });
  });
});

describe('descargar mis datos', () => {
  it('incluye cuenta, datos guardados y pedidos, sin ids internos completos', () => {
    const data = accountExport(
      { email: 'a@x.com', created_at: '2026-01-01', user_metadata: { shipping: { name: 'Ana Paz', document: '30111222' } } },
      [{ id: 'abcd1234-0000-0000-0000-000000000000', created_at: '2026-02-01', status: 'pagado', total: 500, items: [{ name: 'Vela', quantity: 1, price: 500 }] }],
      { name: 'Velas', slug: 'velas' }
    );
    expect(data.cuenta.email).toBe('a@x.com');
    expect(data.datos.document).toBe('30111222');
    expect(data.pedidos[0]).toMatchObject({ numero: 'ABCD1234', total: 500, articulos: [{ nombre: 'Vela', cantidad: 1, precio: 500 }] });
  });
});

describe('vuelta desde un enlace del mail', async () => {
  const { authReturnTarget } = await import('./authReturn.js');
  const loc = (path, hash) => ({ origin: 'https://t.com', pathname: path, hash });
  const saved = { url: 'https://t.com/perfil?tab=datos&bienvenida=1', at: Date.now() };

  it('si cae en otra página del mismo sitio, la lleva a la correcta con la sesión', () => {
    expect(authReturnTarget(loc('/', '#access_token=abc&type=signup'), saved)).toBe('https://t.com/perfil?tab=datos&bienvenida=1#access_token=abc&type=signup');
  });
  it('no hace nada sin enlace, si ya está en la página, si es otro sitio o si es viejo', () => {
    expect(authReturnTarget(loc('/', ''), saved)).toBeNull();
    expect(authReturnTarget(loc('/perfil', '#access_token=abc'), saved)).toBeNull();
    expect(authReturnTarget(loc('/', '#access_token=abc'), { ...saved, url: 'https://otro.com/perfil' })).toBeNull();
    expect(authReturnTarget(loc('/', '#access_token=abc'), { ...saved, at: Date.now() - 8 * 86400000 })).toBeNull();
  });
});
