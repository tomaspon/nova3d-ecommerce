import { describe, it, expect } from 'vitest';
import { slugify, slugError, normalizeDomain, isValidDomain, storeUrls } from './platformStores';

describe('slugify / slugError', () => {
  it('arma un slug válido a partir del nombre', () => {
    expect(slugify('Velas Luña & Co.')).toBe('velas-luna-co');
    expect(slugify('  --Café--  ')).toBe('cafe');
    expect(slugError(slugify('Velas Luña & Co.'))).toBeNull();
  });

  it('rechaza slugs inválidos o reservados', () => {
    expect(slugError('')).not.toBeNull();
    expect(slugError('-velas')).not.toBeNull();
    expect(slugError('Velas')).not.toBeNull();
    expect(slugError('admin')).toMatch(/reservado/);
  });
});

describe('normalizeDomain / isValidDomain', () => {
  it('limpia lo que se pega desde el navegador', () => {
    expect(normalizeDomain('https://www.VelasLuna.com.ar/tienda?x=1')).toBe('velasluna.com.ar');
    expect(normalizeDomain('tienda.velas.com:443')).toBe('tienda.velas.com');
  });

  it('acepta dominios reales y rechaza cualquier otra cosa', () => {
    expect(isValidDomain('velasluna.com.ar')).toBe(true);
    expect(isValidDomain('tienda.velas.com')).toBe(true);
    expect(isValidDomain('velasluna')).toBe(false);
    expect(isValidDomain('velas luna.com')).toBe(false);
    expect(isValidDomain('-velas.com')).toBe(false);
  });
});

describe('storeUrls', () => {
  const store = { slug: 'velas-demo', custom_domain: null };

  it('sin dominio de plataforma usa ?tienda= en la dirección actual', () => {
    expect(storeUrls(store, { origin: 'https://x.vercel.app' })).toEqual({
      storefront: 'https://x.vercel.app/?tienda=velas-demo',
      admin: 'https://x.vercel.app/panel/velas-demo'
    });
  });

  it('con dominio de plataforma usa el subdominio; el dominio propio manda sobre todo', () => {
    expect(storeUrls(store, { platformDomain: 'tiendas.com' }).storefront).toBe('https://velas-demo.tiendas.com');
    const own = storeUrls({ ...store, custom_domain: 'velas.com.ar' }, { platformDomain: 'tiendas.com', platformOrigin: 'https://tiendas.com' });
    expect(own.storefront).toBe('https://velas.com.ar');
    // El panel siempre vive en la plataforma, con la tienda en la dirección
    expect(own.admin).toBe('https://tiendas.com/panel/velas-demo');
  });
});
