import { isPaid, isCanceled, isAwaitingPayment } from './orderStatus.js';
import { lineTotal } from './pricing.js';
import { DEFAULT_STORE_ID } from './storeIds.js';

// Estadísticas del panel de plataforma (todas las tiendas). Lo calcula el servidor
// (api/platform-stats.js) con los datos completos; acá solo hay cuentas, sin acceso a la base.

const DAY = 86400000;
const AR_OFFSET = 3 * 3600000; // los días se cortan a la medianoche de Argentina (UTC-3)

export const dayKey = (value) => new Date(new Date(value).getTime() - AR_OFFSET).toISOString().slice(0, 10);

// Lunes de la semana (en hora argentina) de una fecha, como 'YYYY-MM-DD'
export function weekKey(value) {
  const d = new Date(new Date(value).getTime() - AR_OFFSET);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset)).toISOString().slice(0, 10);
}

const isExpired = (status) => (status || '').toLowerCase().includes('tiempo agotado');

export function buildPlatformStats({ stores = [], orders = [], products = [], users = [], members = [], feePercent = 0, now = Date.now(), days = 90, weeks = 12 }) {
  const paid = orders.filter(o => isPaid(o.status));
  const gmv = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const storeOf = (o) => o.store_id || DEFAULT_STORE_ID;
  // La tienda principal es la plantilla base, no un cliente: no suma en los contadores de tiendas
  const clientStores = stores.filter(s => s.id !== DEFAULT_STORE_ID);

  // Serie diaria de los últimos `days` días (incluye hoy), con ceros donde no hubo ventas
  const daily = [];
  for (let i = days - 1; i >= 0; i--) daily.push({ date: dayKey(now - i * DAY), revenue: 0, orders: 0, created: 0 });
  const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
  for (const o of orders) {
    const i = dayIndex.get(dayKey(o.created_at));
    if (i === undefined) continue;
    daily[i].created += 1;
    if (isPaid(o.status)) {
      daily[i].revenue += Number(o.total) || 0;
      daily[i].orders += 1;
    }
  }

  // Altas por semana: tiendas y cuentas
  const weekly = [];
  const thisWeek = weekKey(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(new Date(`${thisWeek}T00:00:00Z`).getTime() - i * 7 * DAY).toISOString().slice(0, 10);
    weekly.push({ week: start, stores: 0, users: 0 });
  }
  const weekIndex = new Map(weekly.map((w, i) => [w.week, i]));
  for (const s of clientStores) { const i = weekIndex.get(weekKey(s.created_at)); if (i !== undefined) weekly[i].stores += 1; }
  for (const u of users) { const i = weekIndex.get(weekKey(u.created_at)); if (i !== undefined) weekly[i].users += 1; }

  // Por tienda
  const ownerEmail = (storeId) => {
    const member = members.find(m => m.store_id === storeId && m.role === 'owner');
    return member ? users.find(u => u.id === member.user_id)?.email || '' : '';
  };
  const byStore = stores.map(s => {
    const own = orders.filter(o => storeOf(o) === s.id);
    const ownPaid = own.filter(o => isPaid(o.status));
    const lastSale = ownPaid.reduce((max, o) => (o.created_at > max ? o.created_at : max), null);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      template: s.template,
      status: s.status,
      salesEnabled: s.sales_enabled !== false,
      mpConnected: Boolean(s.mp_connected),
      activationRequested: Boolean(s.activation_requested_at) && s.sales_enabled === false,
      createdAt: s.created_at,
      ownerEmail: ownerEmail(s.id),
      products: products.filter(p => p.store_id === s.id && p.is_active).length,
      orders: own.length,
      paidOrders: ownPaid.length,
      revenue: ownPaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      lastSale
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Productos más vendidos (en todas las tiendas)
  const productTotals = new Map();
  for (const o of paid) {
    for (const item of o.items || []) {
      const key = `${storeOf(o)}:${item.id}`;
      const current = productTotals.get(key) || { name: item.name, store: stores.find(s => s.id === storeOf(o))?.name || '', units: 0, revenue: 0 };
      current.units += Number(item.quantity) || 0;
      current.revenue += lineTotal(item);
      productTotals.set(key, current);
    }
  }
  const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // Mezclas
  const count = (list, keyFn) => {
    const map = new Map();
    for (const item of list) map.set(keyFn(item), (map.get(keyFn(item)) || 0) + 1);
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const paymentMix = count(paid, o => o.payment_method || 'Sin dato');
  const statusMix = [
    { label: 'Pagados', value: paid.length },
    { label: 'Esperando pago', value: orders.filter(o => isAwaitingPayment(o.status)).length },
    { label: 'Vencidos sin pagar', value: orders.filter(o => isExpired(o.status)).length },
    { label: 'Cancelados', value: orders.filter(o => isCanceled(o.status) && !isExpired(o.status)).length }
  ].filter(p => p.value > 0);
  const templateMix = count(clientStores, s => s.template || 'general');

  const expired = orders.filter(o => isExpired(o.status)).length;
  const sellerMpRevenue = paid
    .filter(o => o.payment_method === 'MercadoPago' && stores.find(s => s.id === storeOf(o))?.mp_connected && storeOf(o) !== DEFAULT_STORE_ID)
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return {
    generatedAt: new Date(now).toISOString(),
    kpis: {
      gmv,
      paidOrders: paid.length,
      avgTicket: paid.length ? gmv / paid.length : 0,
      stores: clientStores.length,
      activeStores: clientStores.filter(s => s.status === 'active').length,
      sellingStores: clientStores.filter(s => s.status === 'active' && s.sales_enabled !== false).length,
      pendingActivation: byStore.filter(s => s.activationRequested).length,
      mpConnected: clientStores.filter(s => s.mp_connected).length,
      users: users.length,
      newUsers30d: users.filter(u => now - new Date(u.created_at).getTime() <= 30 * DAY).length,
      activeProducts: products.filter(p => p.is_active).length,
      // De los pedidos que se resolvieron (pagados o vencidos), cuántos terminaron pagos
      paymentConversion: paid.length + expired ? paid.length / (paid.length + expired) : null,
      estimatedFees: Math.round(sellerMpRevenue * (Number(feePercent) || 0)) / 100
    },
    daily,
    weekly,
    byStore,
    topProducts,
    paymentMix,
    statusMix,
    templateMix
  };
}
