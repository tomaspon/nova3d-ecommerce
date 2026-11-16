import { describe, it, expect, beforeEach } from 'vitest';
import { searchProducts, rememberView, rememberCart, recentlyViewed, pickedForYou, relatedFor, forgetHistory, normalizeText } from './personalization';

const P = [
  { id: 'r1', name: 'Remera Oversize Arena', category: 'Remeras', price: 100, is_active: true, available_stock: 3 },
  { id: 'r2', name: 'Remera Básica Negra', category: 'Remeras', price: 80, is_active: true, available_stock: 5, discount: 20 },
  { id: 'c1', name: 'Campera Rompeviento', category: 'Abrigos', price: 300, is_active: true, available_stock: 2, description: 'Ideal para el invierno' },
  { id: 'b1', name: 'Buzo Lila', category: 'Abrigos', price: 200, is_active: true, available_stock: 0 },
  { id: 'j1', name: 'Jean Clásico Azul', category: 'Pantalones', price: 250, is_active: true, available_stock: 4, variants: [{ name: '42', stock: 1 }] },
  { id: 'x1', name: 'Remera Pausada', category: 'Remeras', price: 90, is_active: false, available_stock: 1 }
];
const names = (list) => list.map(p => p.id);

// Almacenamiento de prueba (vitest corre sin navegador)
beforeEach(() => {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  globalThis.window = { self: 1, top: 1 };
});

describe('búsqueda tolerante', () => {
  it('ignora tildes, mayúsculas y plurales', () => {
    expect(normalizeText('Clásico ÁZUL')).toBe('clasico azul');
    expect(names(searchProducts(P, 'clasico'))).toEqual(['j1']);
    expect(names(searchProducts(P, 'camperas'))).toEqual(['c1']);
    expect(names(searchProducts(P, 'REMERAS'))).toEqual(expect.arrayContaining(['r1', 'r2']));
  });

  it('perdona errores de tipeo', () => {
    expect(names(searchProducts(P, 'remra'))).toEqual(expect.arrayContaining(['r1', 'r2']));
    expect(names(searchProducts(P, 'campra'))).toEqual(['c1']);
    expect(names(searchProducts(P, 'rompevineto'))).toEqual(['c1']);
  });

  it('todas las palabras tienen que estar; busca también en categoría, descripción y talles', () => {
    expect(names(searchProducts(P, 'remera negra'))).toEqual(['r2']);
    expect(names(searchProducts(P, 'invierno'))).toEqual(['c1']);
    expect(names(searchProducts(P, 'abrigos'))).toEqual(['c1', 'b1']);
    expect(names(searchProducts(P, 'jean 42'))).toEqual(['j1']);
    expect(searchProducts(P, 'zapatillas')).toEqual([]);
  });

  it('lo que coincide en el nombre va primero', () => {
    const list = [{ id: 'a', name: 'Bolso', description: 'Combina con la remera' }, { id: 'b', name: 'Remera' }];
    expect(names(searchProducts(list, 'remera'))).toEqual(['b', 'a']);
  });

  it('sin palabras devuelve todo', () => {
    expect(searchProducts(P, '  ')).toBe(P);
  });
});

describe('lo que vio cada visitante', () => {
  it('"Volvé a lo que viste": lo último primero, sin repetir, sin el actual ni lo pausado', () => {
    rememberView('t1', P[0]); rememberView('t1', P[2]); rememberView('t1', P[5]); rememberView('t1', P[0]);
    expect(names(recentlyViewed('t1', P))).toEqual(['r1', 'c1']);
    expect(names(recentlyViewed('t1', P, { exclude: 'r1' }))).toEqual(['c1']);
    // Cada tienda tiene su propio historial
    expect(recentlyViewed('t2', P)).toEqual([]);
  });

  it('"Elegidos para vos": de su categoría favorita, sin lo visto ni lo agotado; con oferta primero', () => {
    expect(pickedForYou('t1', P)).toEqual([]); // sin historial no se inventa nada
    rememberView('t1', P[0]);
    rememberView('t1', P[2]);
    rememberCart('t1', P[0]); // las remeras pesan más
    expect(names(pickedForYou('t1', P))).toEqual(['r2']); // c1 y r1 ya vistos, b1 agotado, x1 pausado
  });

  it('se puede borrar', () => {
    rememberView('t1', P[0]);
    forgetHistory('t1');
    expect(recentlyViewed('t1', P)).toEqual([]);
  });

  it('no guarda nada desde la vista previa encuadrada', () => {
    globalThis.window = { self: 1, top: 2 };
    rememberView('t1', P[0]);
    expect(recentlyViewed('t1', P)).toEqual([]);
  });
});

describe('relacionados', () => {
  it('primero lo que miraron otros, después de la misma categoría', () => {
    expect(names(relatedFor(P[0], P, ['j1', 'x1', 'r1']))).toEqual(['j1', 'r2']);
    expect(names(relatedFor(P[2], P))).toEqual(['b1']);
  });
});
