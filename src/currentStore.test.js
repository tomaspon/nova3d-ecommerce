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
  it('en localhost permite elegir tienda con ?tienda= y la recuerda en la pestaña', () => {
    const storage = memoryStorage();
    expect(storeOverride(at('localhost', '?tienda=Velas-Luna'), storage)).toBe('velas-luna');
    expect(storeOverride(at('localhost'), storage)).toBe('velas-luna');
    expect(storeOverride(at('localhost', '?tienda='), storage)).toBeNull();
    expect(storeOverride(at('localhost'), storage)).toBeNull();
  });

  it('en un dominio real se ignora: manda el dominio', () => {
    const storage = memoryStorage();
    storage.setItem('store_override', 'velas-luna');
    expect(storeOverride(at('minimal.com.ar', '?tienda=velas-luna'), storage)).toBeNull();
  });
});
