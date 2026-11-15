import { describe, it, expect, vi } from 'vitest';

// La base falsa no conoce ninguna tienda por dominio ni por slug
const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));

const { resolveStore } = await import('./currentStore');
const { DEMO_PRODUCTS, DEMO_STORE } = await import('./demoStore');
const { mapProduct } = await import('./productMapping');
const { slugError } = await import('./platformStores');

const memoryStorage = () => {
  const data = {};
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } };
};

describe('tienda de ejemplo', () => {
  it('?tienda=demo abre la tienda incorporada, sin buscarla en la base', async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: null, error: null }); // ningún dominio
    rpc.mockResolvedValueOnce({ data: { slug: 'minimal', branding: { primary_color: '#4f46e5', logo_url: 'https://x/logo.png' } }, error: null });
    const store = await resolveStore({ host: 'x.vercel.app', hostname: 'x.vercel.app', search: '?tienda=demo' }, memoryStorage());
    expect(store).toMatchObject({ id: DEMO_STORE.id, name: DEMO_STORE.name, isDemo: true });
    // Toma solo el estilo de la plantilla base (no su logo); los productos son los propios
    expect(store.branding).toEqual({ primary_color: '#4f46e5' });
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['get_store_by_host', 'get_store_by_slug']);
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
