import { describe, it, expect } from 'vitest';
import { buildReceiptHtml } from './printReceipt';
import { escapeHtml } from './escapeHtml';
import { parseBannerUrl, buildBannerUrl } from './bannerPosition';
import { parseImages, mapProduct } from './productMapping';

const order = {
  id: '62f05735-7d9f-4672-baaf-32244f18afc3',
  created_at: '2026-10-01T23:17:12Z',
  status: 'pagado',
  payment_method: 'MercadoPago',
  total: 8100,
  customer_name: '<img src=x onerror=alert(1)>',
  customer_email: 'cliente@ejemplo.com',
  customer_document: '30111222',
  customer_phone: '291555',
  shipping_address: { street: 'Caronti', number: '444', city: 'Bahia Blanca', state: 'Buenos Aires', zip: '8000' },
  items: [{ name: 'Remera <script>alert(1)</script>', price: 9000, discount: 10, quantity: 1 }]
};

describe('escapeHtml', () => {
  it('neutraliza los caracteres que abren HTML', () => {
    expect(escapeHtml('<b a="1">&\'</b>')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(5)).toBe('5');
  });
});

describe('buildReceiptHtml', () => {
  it('no deja pasar HTML escrito por un cliente', () => {
    const html = buildReceiptHtml(order, { showCustomerDetails: true });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('muestra el importe con el descuento aplicado', () => {
    const html = buildReceiptHtml(order);
    expect(html).toContain('$8.100');
    expect(html).not.toContain('$9.000');
  });

  it('el comprobante del cliente no incluye DNI, teléfono ni dirección', () => {
    const html = buildReceiptHtml(order);
    expect(html).not.toContain('30111222');
    expect(html).not.toContain('291555');
    expect(html).not.toContain('Caronti');
  });

  it('el del panel sí los incluye', () => {
    const html = buildReceiptHtml(order, { showCustomerDetails: true });
    expect(html).toContain('30111222');
    expect(html).toContain('Caronti 444');
  });
});

describe('bannerPosition', () => {
  it('lee y arma el encuadre guardado en la URL', () => {
    expect(parseBannerUrl('https://x/a.jpg#y=35')).toEqual({ src: 'https://x/a.jpg', y: 35 });
    expect(parseBannerUrl('https://x/a.jpg')).toEqual({ src: 'https://x/a.jpg', y: 50 });
    expect(parseBannerUrl('https://x/a.jpg#y=250').y).toBe(100);
    expect(buildBannerUrl('https://x/a.jpg', 34.6)).toBe('https://x/a.jpg#y=35');
    expect(buildBannerUrl('https://x/a.jpg', 50)).toBe('https://x/a.jpg');
  });
});

describe('productMapping', () => {
  it('acepta una URL sola o un arreglo JSON de imágenes', () => {
    expect(parseImages('https://x/a.jpg')).toEqual(['https://x/a.jpg']);
    expect(parseImages('["https://x/a.jpg","https://x/b.jpg"]')).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    expect(parseImages('[roto')).toEqual(['[roto']);
    expect(parseImages(null)).toEqual([]);
  });

  it('disponible = stock físico menos lo reservado', () => {
    const product = mapProduct({ id: 'p1', stock: 3, image_url: null, is_active: true }, { p1: 3 });
    expect(product.stock).toBe(3);
    expect(product.reserved_stock).toBe(3);
    expect(product.available_stock).toBe(0);

    const free = mapProduct({ id: 'p1', stock: 3, image_url: null, is_active: true }, {});
    expect(free.reserved_stock).toBe(0);
    expect(free.available_stock).toBe(3);
  });
});
