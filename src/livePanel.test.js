import { describe, it, expect, vi } from 'vitest';
vi.mock('./supabaseClient', () => ({ supabase: {} }));
const { describeEvent } = await import('./pages/platform/LivePanel');

describe('en vivo: cada evento en palabras', () => {
  it('cuenta lo que hizo el visitante', () => {
    expect(describeEvent({ type: 'add_to_cart', product: 'Buzo Lila', label: 'M' })).toBe('agregó Buzo Lila (M) al carrito');
    expect(describeEvent({ type: 'search', label: 'jean' })).toBe('buscó "jean"');
    expect(describeEvent({ type: 'payment_select', label: 'MercadoPago' })).toBe('eligió pagar con MercadoPago');
    expect(describeEvent({ type: 'product_view', product: 'Jean', label: 'agotado' })).toBe('miró Jean (agotado)');
    expect(describeEvent({ type: 'page_view', path: '/producto/123' })).toBe('abrió una ficha de producto');
    expect(describeEvent({ type: 'order_error', label: 'Sin stock' })).toBe('no pudo hacer el pedido: Sin stock');
  });
});
