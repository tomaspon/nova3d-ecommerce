import { describe, it, expect } from 'vitest';
import { storeOverride } from './currentStore';

const memoryStorage = () => {
  const data = {};
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; }
  };
};
const at = (hostname, search = '') => ({ hostname, search });

describe('storeOverride', () => {
  it('permite elegir tienda con ?tienda= y la recuerda en la pestaña', () => {
    const storage = memoryStorage();
    expect(storeOverride(at('localhost', '?tienda=Velas-Luna'), storage)).toBe('velas-luna');
    expect(storeOverride(at('localhost'), storage)).toBe('velas-luna');
    expect(storeOverride(at('localhost', '?tienda='), storage)).toBeNull();
    expect(storeOverride(at('localhost'), storage)).toBeNull();
  });

  it('funciona igual en la dirección de Vercel (el dominio propio se resuelve antes, en resolveStore)', () => {
    const storage = memoryStorage();
    expect(storeOverride(at('nova3d-ecommerce.vercel.app', '?tienda=velas-demo'), storage)).toBe('velas-demo');
  });
});
