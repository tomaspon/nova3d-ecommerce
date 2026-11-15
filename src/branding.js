// Marca de cada tienda (stores.branding): logo, color, tipografía, textos, anuncio y redes.
// La edita el dueño desde Panel > Diseño; la tienda la aplica con applyBranding().

export const BRAND_COLORS = [
  { label: 'Negro', value: '' },
  { label: 'Índigo', value: '#4f46e5' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Esmeralda', value: '#059669' },
  { label: 'Oliva', value: '#5f6b2f' },
  { label: 'Ámbar', value: '#d97706' },
  { label: 'Coral', value: '#e2553f' },
  { label: 'Rosa', value: '#db2777' }
];

export const FONT_OPTIONS = [
  { id: 'jakarta', label: 'Moderna', family: "'Plus Jakarta Sans', system-ui, sans-serif", css: null },
  { id: 'elegante', label: 'Elegante', family: "'Fraunces', Georgia, serif", css: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&display=swap' },
  { id: 'geometrica', label: 'Geométrica', family: "'Space Grotesk', system-ui, sans-serif", css: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap' },
  { id: 'redondeada', label: 'Redondeada', family: "'Nunito', system-ui, sans-serif", css: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&display=swap' }
];

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// Siempre devuelve una marca completa, con lo que falte en sus valores por defecto
export function normalizeBranding(input = {}) {
  const b = input || {};
  return {
    logo_url: clean(b.logo_url, 500),
    primary_color: HEX.test(b.primary_color || '') ? b.primary_color.toLowerCase() : '',
    font: FONT_OPTIONS.some(f => f.id === b.font) ? b.font : 'jakarta',
    theme: ['light', 'dark'].includes(b.theme) ? b.theme : 'light',
    headline_light: clean(b.headline_light, 60),
    headline_bold: clean(b.headline_bold, 60),
    tagline: clean(b.tagline, 140),
    about_title: clean(b.about_title, 80),
    about_text: clean(b.about_text, 1200),
    announcement_active: Boolean(b.announcement_active),
    announcement_text: clean(b.announcement_text, 120),
    instagram: clean(b.instagram, 60).replace(/^@/, ''),
    tiktok: clean(b.tiktok, 60).replace(/^@/, ''),
    whatsapp_button: Boolean(b.whatsapp_button)
  };
}

// Tinta legible sobre un color de fondo (blanco o casi negro), según su luminancia
export function inkFor(hex) {
  if (!HEX.test(hex || '')) return '#ffffff';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste contra blanco vs contra negro: gana el mayor
  return (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.05) ? '#ffffff' : '#0b0b0b';
}

// Aplica la marca a la página: color de los botones y acentos, tipografía e ícono de la pestaña
export function applyBranding(branding, doc = document) {
  const b = normalizeBranding(branding);
  const root = doc.documentElement;
  if (b.primary_color) {
    root.style.setProperty('--brand', b.primary_color);
    root.style.setProperty('--brand-ink', inkFor(b.primary_color));
  } else {
    root.style.removeProperty('--brand');
    root.style.removeProperty('--brand-ink');
  }

  const font = FONT_OPTIONS.find(f => f.id === b.font);
  if (font.css && !doc.querySelector(`link[data-brand-font="${font.id}"]`)) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.css;
    link.dataset.brandFont = font.id;
    doc.head.appendChild(link);
  }
  root.style.setProperty('--font-store', font.family);

  const icon = doc.querySelector('link[rel="icon"]');
  if (icon) {
    if (!icon.dataset.default) icon.dataset.default = icon.getAttribute('href');
    icon.setAttribute('href', b.logo_url || icon.dataset.default);
  }
}

export const instagramUrl = (handle) => (handle ? `https://instagram.com/${encodeURIComponent(handle)}` : null);
export const tiktokUrl = (handle) => (handle ? `https://tiktok.com/@${encodeURIComponent(handle)}` : null);
