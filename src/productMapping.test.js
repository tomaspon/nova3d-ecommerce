import { describe, it, expect } from 'vitest';
import { mapProduct, availableFor, cartKey, variantKey } from './productMapping';

describe('productos con talles', () => {
  const row = { id: 'p1', name: 'Remera', stock: 5, variant_label: 'Talle', variants: [{ name: 'S', stock: 2 }, { name: 'M', stock: 3 }] };

  it('cada talle descuenta solo sus reservas', () => {
    const p = mapProduct(row, { p1: 2, [variantKey('p1', 'M')]: 2 });
    expect(p.variants).toEqual([
      { name: 'S', stock: 2, reserved: 0, available: 2 },
      { name: 'M', stock: 3, reserved: 2, available: 1 }
    ]);
    expect(p.available_stock).toBe(3);
    expect(availableFor(p, 'M')).toBe(1);
    expect(availableFor(p, 'XL')).toBe(0);
  });

  it('sin talles funciona como siempre', () => {
    const p = mapProduct({ id: 'p2', stock: 4 }, { p2: 1 });
    expect(p.variants).toEqual([]);
    expect(p.available_stock).toBe(3);
    expect(availableFor(p)).toBe(3);
  });

  it('en el carrito, la misma remera en S y en M son dos renglones', () => {
    expect(cartKey({ id: 'p1', variant: 'S' })).not.toBe(cartKey({ id: 'p1', variant: 'M' }));
    expect(cartKey({ id: 'p2' })).toBe('p2');
  });
});
