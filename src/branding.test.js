import { describe, it, expect } from 'vitest';
import { normalizeBranding, inkFor, instagramUrl, applyBranding } from './branding';

describe('normalizeBranding', () => {
  it('completa lo que falta con valores por defecto', () => {
    expect(normalizeBranding({})).toMatchObject({ primary_color: '', font: 'jakarta', theme: 'light', announcement_active: false });
    expect(normalizeBranding(null).font).toBe('jakarta');
  });

  it('descarta colores, tipografías y modos inválidos, y limpia las redes', () => {
    const b = normalizeBranding({ primary_color: 'rojo', font: 'comic', theme: 'neon', instagram: '@velas.luna' });
    expect(b).toMatchObject({ primary_color: '', font: 'jakarta', theme: 'light', instagram: 'velas.luna' });
    expect(normalizeBranding({ primary_color: '#E2553F' }).primary_color).toBe('#e2553f');
  });

  it('recorta textos demasiado largos', () => {
    expect(normalizeBranding({ announcement_text: 'x'.repeat(500) }).announcement_text).toHaveLength(120);
  });
});

describe('inkFor', () => {
  it('elige la tinta que más contrasta con el color de marca', () => {
    expect(inkFor('#4f46e5')).toBe('#ffffff'); // índigo → blanco
    expect(inkFor('#fde047')).toBe('#0b0b0b'); // amarillo claro → negro
    expect(inkFor('#0b0b0b')).toBe('#ffffff');
  });
});

describe('redes', () => {
  it('arma los links a partir del usuario', () => {
    expect(instagramUrl('velas.luna')).toBe('https://instagram.com/velas.luna');
    expect(instagramUrl('')).toBeNull();
  });
});

describe('opciones de catálogo, estilo y colores', () => {
  it('por defecto todo se ve como siempre', () => {
    expect(normalizeBranding({})).toMatchObject({
      button_shape: 'pill', image_ratio: 'portrait', grid_columns: 4, background: 'hueso', default_sort: 'destacados',
      dark_background: 'carbon', accent_color: '', announcement_color: '', background_custom: '',
      show_store_name: true, show_category: true, quick_add: true, show_benefits: true, show_coming_soon: true,
      campaign_position: 'top'
    });
    expect(normalizeBranding({ campaign_position: 'before_catalog' }).campaign_position).toBe('before_catalog');
    expect(normalizeBranding({ campaign_position: 'costado' }).campaign_position).toBe('top');
  });

  it('acepta solo valores válidos', () => {
    const b = normalizeBranding({ button_shape: 'estrella', image_ratio: 'panoramica', grid_columns: '7', default_sort: 'azar', dark_background: 'rojo', accent_color: 'rojo' });
    expect(b).toMatchObject({ button_shape: 'pill', image_ratio: 'portrait', grid_columns: 4, default_sort: 'destacados', dark_background: 'carbon', accent_color: '' });
    expect(normalizeBranding({ grid_columns: '5', show_category: false, quick_add: false }).grid_columns).toBe(5);
    expect(normalizeBranding({ show_benefits: false }).show_benefits).toBe(false);
  });
});

// Documento mínimo para probar applyBranding sin navegador
function fakeDocument() {
  const props = {};
  const head = [];
  const root = {
    dataset: {},
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } }
  };
  const icon = { dataset: {}, attrs: { href: '/favicon.svg' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } };
  return {
    props, head, icon,
    documentElement: root,
    head: { appendChild: (el) => head.push(el) },
    createElement: () => ({ dataset: {} }),
    querySelector: (sel) => (sel === 'link[rel="icon"]' ? icon : head.find(l => sel.includes(l.dataset.brandFont)) || null)
  };
}

describe('applyBranding', () => {
  it('aplica colores, fondo, formato, forma de botones, tipografía e ícono', () => {
    const doc = fakeDocument();
    applyBranding({
      primary_color: '#4f46e5', accent_color: '#16a34a', background: 'crema', dark_background: 'noche',
      image_ratio: 'square', button_shape: 'square', font: 'elegante', logo_url: 'https://x/logo.png', announcement_color: '#fde047'
    }, doc);
    expect(doc.props).toMatchObject({
      '--brand': '#4f46e5', '--brand-ink': '#ffffff',
      '--accent': '#16a34a', '--store-bg': '#fbf7f0', '--store-bg-dark': '#0d1320',
      '--card-aspect': '1 / 1', '--card-span-aspect': '2.05 / 1',
      '--announce-bg': '#fde047', '--announce-ink': '#0b0b0b'
    });
    expect(doc.props['--font-store']).toContain('Fraunces');
    expect(doc.documentElement.dataset.buttons).toBe('square');
    expect(doc.icon.attrs.href).toBe('https://x/logo.png');
  });

  it('el fondo a elección gana sobre el predefinido, y sin marca vuelve todo a lo normal', () => {
    const doc = fakeDocument();
    applyBranding({ background: 'crema', background_custom: '#ffeedd', primary_color: '#4f46e5', announcement_color: '#000000' }, doc);
    expect(doc.props['--store-bg']).toBe('#ffeedd');
    applyBranding({}, doc);
    expect(doc.props['--brand']).toBeUndefined();
    expect(doc.props['--announce-bg']).toBeUndefined();
    expect(doc.props['--store-bg']).toBe('#fafafa');
    expect(doc.props['--accent']).toBe('#ef4444');
    expect(doc.icon.attrs.href).toBe('/favicon.svg');
  });
});
