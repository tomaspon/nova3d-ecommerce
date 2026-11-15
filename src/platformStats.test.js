import { describe, it, expect } from 'vitest';
import { buildPlatformStats, dayKey, weekKey } from './platformStats';

const MINIMAL = '00000000-0000-0000-0000-000000000001';
const now = new Date('2026-11-14T15:00:00Z').getTime(); // sábado, mediodía en Argentina

const stores = [
  { id: MINIMAL, name: 'MINIMAL.', slug: 'minimal', status: 'active', template: 'ropa', created_at: '2026-10-01T12:00:00Z' },
  { id: 'velas', name: 'Velas', slug: 'velas', status: 'active', template: 'velas', sales_enabled: true, mp_connected: true, created_at: '2026-11-10T12:00:00Z' },
  { id: 'nueva', name: 'Nueva', slug: 'nueva', status: 'active', template: 'ropa', sales_enabled: false, activation_requested_at: '2026-11-13T00:00:00Z', created_at: '2026-11-13T12:00:00Z' }
];
const orders = [
  { store_id: MINIMAL, status: 'pagado', total: 1000, payment_method: 'Transferencia', created_at: '2026-11-14T13:00:00Z', items: [{ id: 'r', name: 'Remera', quantity: 2, price: 500 }] },
  { store_id: 'velas', status: 'entregado', total: 3000, payment_method: 'MercadoPago', created_at: '2026-11-13T13:00:00Z', items: [{ id: 'v', name: 'Vela', quantity: 3, price: 1000 }] },
  { store_id: 'velas', status: 'cancelado (tiempo agotado)', total: 999, payment_method: 'MercadoPago', created_at: '2026-11-12T13:00:00Z', items: [] },
  { store_id: null, status: 'reservado', total: 50, payment_method: 'MercadoPago', created_at: '2026-11-14T14:00:00Z', items: [] }
];
const users = [
  { id: 'u1', email: 'duena@velas.com', created_at: '2026-11-10T12:00:00Z' },
  { id: 'u2', email: 'viejo@x.com', created_at: '2026-08-01T12:00:00Z' }
];
const members = [{ store_id: 'velas', user_id: 'u1', role: 'owner' }];
const products = [{ store_id: 'velas', is_active: true }, { store_id: 'velas', is_active: false }];

const stats = buildPlatformStats({ stores, orders, products, users, members, feePercent: 5, now });

describe('buildPlatformStats', () => {
  it('cuenta facturación y ventas solo con pedidos pagados', () => {
    expect(stats.kpis).toMatchObject({ gmv: 4000, paidOrders: 2, avgTicket: 2000, users: 2, newUsers30d: 1, activeProducts: 1 });
    expect(stats.kpis.paymentConversion).toBeCloseTo(2 / 3);
  });

  it('estima la comisión solo sobre ventas por MercadoPago de vendedores conectados', () => {
    expect(stats.kpis.estimatedFees).toBe(150); // 5% de 3000
  });

  it('separa tiendas activas, que venden y que pidieron activación (la plantilla base no cuenta como cliente)', () => {
    expect(stats.kpis).toMatchObject({ stores: 2, activeStores: 2, sellingStores: 1, pendingActivation: 1, mpConnected: 1 });
  });

  it('arma la serie diaria con ceros y corta los días en hora argentina', () => {
    expect(stats.daily).toHaveLength(90);
    const today = stats.daily.at(-1);
    expect(today).toMatchObject({ date: '2026-11-14', revenue: 1000, orders: 1, created: 2 });
    expect(dayKey('2026-11-15T02:00:00Z')).toBe('2026-11-14'); // 23 h del 14 en Argentina
  });

  it('agrupa altas por semana (desde el lunes)', () => {
    expect(weekKey('2026-11-14T15:00:00Z')).toBe('2026-11-09');
    expect(stats.weekly.at(-1)).toEqual({ week: '2026-11-09', stores: 2, users: 1 });
  });

  it('ordena las tiendas por facturación, con su dueño y última venta', () => {
    expect(stats.byStore.map(s => s.slug)).toEqual(['velas', 'minimal', 'nueva']);
    expect(stats.byStore[0]).toMatchObject({ ownerEmail: 'duena@velas.com', products: 1, orders: 2, paidOrders: 1, revenue: 3000 });
    expect(stats.byStore[2]).toMatchObject({ activationRequested: true, salesEnabled: false });
    // Las órdenes viejas sin tienda son de MINIMAL
    expect(stats.byStore.find(s => s.slug === 'minimal').orders).toBe(2);
  });

  it('calcula los productos más vendidos y las mezclas', () => {
    expect(stats.topProducts[0]).toMatchObject({ name: 'Vela', store: 'Velas', units: 3, revenue: 3000 });
    expect(stats.paymentMix).toEqual(expect.arrayContaining([{ label: 'MercadoPago', value: 1 }, { label: 'Transferencia', value: 1 }]));
    expect(stats.statusMix).toEqual([
      { label: 'Pagados', value: 2 },
      { label: 'Esperando pago', value: 1 },
      { label: 'Vencidos sin pagar', value: 1 }
    ]);
    expect(stats.templateMix).toEqual(expect.arrayContaining([{ label: 'ropa', value: 1 }, { label: 'velas', value: 1 }]));
  });
});
