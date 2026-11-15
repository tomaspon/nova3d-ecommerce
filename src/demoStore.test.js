import { describe, it, expect, vi } from 'vitest';

// La base falsa no conoce ninguna tienda por dominio ni por slug
const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));

const { resolveStore, isShowcaseStore } = await import('./currentStore');
const { DEFAULT_STORE_ID } = await import('./storeIds');
const { DEMO_PRODUCTS, DEMO_STORE } = await import('./demoStore');
const { mapProduct } = await import('./productMapping');
const { slugError } = await import('./platformStores');

const memoryStorage = () => {
  const data = {};
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } };
};

describe('tienda de ejemplo', () => {
  it('?tienda=demo lleva a MINIMAL, que es tienda de muestra (no se compra)', async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: null, error: null }); // ningún dominio
    rpc.mockResolvedValueOnce({ data: { id: DEFAULT_STORE_ID, slug: 'minimal', name: 'MINIMAL.' }, error: null });
    const store = await resolveStore({ host: 'x.vercel.app', hostname: 'x.vercel.app', search: '?tienda=demo' }, memoryStorage());
    expect(store).toMatchObject({ slug: 'minimal', isShowcase: true });
    expect(isShowcaseStore(store)).toBe(true);
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['get_store_by_host', 'get_store_by_slug']);
  });

  it('MINIMAL abierta directo también es de muestra; las demás tiendas venden', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: { id: DEFAULT_STORE_ID, slug: 'minimal', name: 'MINIMAL.' }, error: null });
    expect(isShowcaseStore(await resolveStore({ host: 'x.vercel.app', hostname: 'x.vercel.app', search: '?tienda=minimal' }, memoryStorage()))).toBe(true);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: { id: 'v', slug: 'velas', name: 'Velas' }, error: null });
    expect(isShowcaseStore(await resolveStore({ host: 'x.vercel.app', hostname: 'x.vercel.app', search: '?tienda=velas' }, memoryStorage()))).toBe(false);
  });

  it('si la base no responde, ?tienda=demo muestra la tienda incorporada', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockRejectedValueOnce(new Error('sin conexión'));
    const store = await resolveStore({ host: 'x.vercel.app', hostname: 'x.vercel.app', search: '?tienda=demo' }, memoryStorage());
    expect(store).toMatchObject({ id: DEMO_STORE.id, isDemo: true });
  });

  it('el dominio propio de una tienda manda sobre ?tienda=demo', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'x', slug: 'velas', name: 'Velas' }, error: null });
    const store = await resolveStore({ host: 'velas.com.ar', hostname: 'velas.com.ar', search: '?tienda=demo' }, memoryStorage());
    expect(store.slug).toBe('velas');
  });

  it('sus productos están completos y con imagen', () => {
    for (const row of DEMO_PRODUCTS) {
      const product = mapProduct(row);
      expect(product.imageUrl).toMatch(/^\/demo\/.+\.svg$/);
      expect(product.available_stock).toBeGreaterThan(0);
      expect(product.price).toBeGreaterThan(0);
    }
  });

  it('ninguna tienda real puede usar el enlace "demo"', () => {
    expect(slugError('demo')).toMatch(/reservado/);
  });
});
