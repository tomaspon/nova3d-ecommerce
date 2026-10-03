import { describe, it, expect } from 'vitest';
import { unitPrice, lineTotal, itemsTotal, formatMoney } from './pricing';

describe('unitPrice', () => {
  it('sin descuento devuelve el precio de lista', () => {
    expect(unitPrice({ price: 9000, discount: 0 })).toBe(9000);
    expect(unitPrice({ price: 9000 })).toBe(9000);
  });

  it('aplica el descuento en porcentaje', () => {
    expect(unitPrice({ price: 9000, discount: 10 })).toBe(8100);
    expect(unitPrice({ price: 10000, discount: 90 })).toBe(1000);
  });

  it('redondea a centavos', () => {
    expect(unitPrice({ price: 999, discount: 33 })).toBe(669.33);
  });

  it('acepta números como texto (así llegan de un formulario)', () => {
    expect(unitPrice({ price: '1200', discount: '10' })).toBe(1080);
  });

  it('no rompe con datos faltantes', () => {
    expect(unitPrice({})).toBe(0);
    expect(unitPrice(undefined)).toBe(0);
  });
});

describe('totales', () => {
  it('lineTotal multiplica el precio con descuento por la cantidad', () => {
    expect(lineTotal({ price: 9000, discount: 10, quantity: 2 })).toBe(16200);
  });

  it('itemsTotal suma todas las líneas', () => {
    expect(itemsTotal([
      { price: 9000, discount: 10, quantity: 2 },
      { price: 1200, discount: 0, quantity: 1 }
    ])).toBe(17400);
    expect(itemsTotal([])).toBe(0);
    expect(itemsTotal(undefined)).toBe(0);
  });
});

describe('formatMoney', () => {
  it('usa separador de miles y sin centavos', () => {
    expect(formatMoney(8100)).toBe('$8.100');
    expect(formatMoney(1234567.4)).toBe('$1.234.567');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(null)).toBe('$0');
  });
});
