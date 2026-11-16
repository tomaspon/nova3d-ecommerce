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

export const BUTTON_SHAPES = [
  { id: 'pill', label: 'Redondos' },
  { id: 'soft', label: 'Suaves' },
  { id: 'square', label: 'Rectos' }
];

export const IMAGE_RATIOS = [
  { id: 'portrait', label: 'Vertical', aspect: '4 / 5', spanAspect: '8.2 / 5' },
  { id: 'square', label: 'Cuadrada', aspect: '1 / 1', spanAspect: '2.05 / 1' },
  { id: 'landscape', label: 'Horizontal', aspect: '4 / 3', spanAspect: '2.7 / 1' }
];

export const BACKGROUNDS = [
  { id: 'hueso', label: 'Hueso', color: '#fafafa' },
  { id: 'blanco', label: 'Blanco', color: '#ffffff' },
  { id: 'crema', label: 'Crema', color: '#fbf7f0' },
  { id: 'niebla', label: 'Niebla', color: '#f1f3f6' }
];

export const DARK_BACKGROUNDS = [
  { id: 'carbon', label: 'Carbón', color: '#121212' },
  { id: 'noche', label: 'Azul noche', color: '#0d1320' },
  { id: 'calido', label: 'Cálido', color: '#17130f' }
];

// Color de las etiquetas de oferta ("% OFF")
export const ACCENT_COLORS = [
  { label: 'Rojo', value: '' },
  { label: 'Coral', value: '#e2553f' },
  { label: 'Rosa', value: '#db2777' },
  { label: 'Violeta', value: '#7c3aed' },
  { label: 'Verde', value: '#16a34a' },
  { label: 'Negro', value: '#0b0b0b' }
];

const DEFAULT_ACCENT = '#ef4444';

export const SORT_OPTIONS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'nuevos', label: 'Más nuevos' },
  { value: 'precio_menor', label: 'Menor precio' },
  { value: 'precio_mayor', label: 'Mayor precio' }
];

export const GRID_COLUMNS = [3, 4, 5];

// Dónde va el banner de la oferta (la oferta se arma en Panel › Ofertas)
export const CAMPAIGN_POSITIONS = [
  { id: 'top', label: 'Portada', hint: 'Grande, arriba de todo' },
  { id: 'compact', label: 'Portada compacta', hint: 'Arriba, más bajo: se ven antes los productos' },
  { id: 'before_catalog', label: 'Antes del catálogo', hint: 'Arriba va la presentación de tu marca' }
];

const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
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
    whatsapp_button: Boolean(b.whatsapp_button),
    // Catálogo y estilo
    button_shape: oneOf(b.button_shape, BUTTON_SHAPES.map(o => o.id), 'pill'),
    image_ratio: oneOf(b.image_ratio, IMAGE_RATIOS.map(o => o.id), 'portrait'),
    grid_columns: oneOf(Number(b.grid_columns), GRID_COLUMNS, 4),
    background: oneOf(b.background, BACKGROUNDS.map(o => o.id), 'hueso'),
    // Colores extra: fondo a elección, fondo oscuro, ofertas y barra de anuncio
    background_custom: HEX.test(b.background_custom || '') ? b.background_custom.toLowerCase() : '',
    dark_background: oneOf(b.dark_background, DARK_BACKGROUNDS.map(o => o.id), 'carbon'),
    accent_color: HEX.test(b.accent_color || '') ? b.accent_color.toLowerCase() : '',
    announcement_color: HEX.test(b.announcement_color || '') ? b.announcement_color.toLowerCase() : '',
    default_sort: oneOf(b.default_sort, SORT_OPTIONS.map(o => o.value), 'destacados'),
    campaign_position: oneOf(b.campaign_position, CAMPAIGN_POSITIONS.map(o => o.id), 'top'),
    // Lo que se muestra (por defecto, todo visible)
    show_store_name: b.show_store_name !== false,
    show_category: b.show_category !== false,
    quick_add: b.quick_add !== false,
    show_benefits: b.show_benefits !== false,
    show_coming_soon: b.show_coming_soon !== false,
    // Recomendaciones con lo que mira cada visitante ("Volvé a lo que viste", "Elegidos para vos"...)
    personalize: b.personalize !== false
  };
}

// Plantilla base (la tienda principal): lo que heredan la tienda de ejemplo y cada tienda nueva.
// Solo el estilo; nunca lo propio de esa marca (logo, textos, redes, anuncio).
export const TEMPLATE_STYLE_FIELDS = [
  'primary_color', 'font', 'theme', 'button_shape', 'image_ratio', 'grid_columns',
  'background', 'background_custom', 'dark_background', 'accent_color', 'announcement_color',
  'default_sort', 'show_category', 'quick_add', 'show_benefits', 'show_coming_soon', 'campaign_position', 'personalize'
];

export const templateStyle = (branding) =>
  Object.fromEntries(TEMPLATE_STYLE_FIELDS.filter(k => branding?.[k] !== undefined).map(k => [k, branding[k]]));

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

  // Forma de los botones (index.css), formato de las fotos y fondo de la tienda
  root.dataset.buttons = b.button_shape;
  const ratio = IMAGE_RATIOS.find(r => r.id === b.image_ratio);
  root.style.setProperty('--card-aspect', ratio.aspect);
  root.style.setProperty('--card-span-aspect', ratio.spanAspect);
  root.style.setProperty('--store-bg', b.background_custom || BACKGROUNDS.find(o => o.id === b.background).color);
  root.style.setProperty('--store-bg-dark', DARK_BACKGROUNDS.find(o => o.id === b.dark_background).color);
  const accent = b.accent_color || DEFAULT_ACCENT;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', inkFor(accent));
  // La barra de anuncio usa su color propio o, si no tiene, el principal
  if (b.announcement_color) {
    root.style.setProperty('--announce-bg', b.announcement_color);
    root.style.setProperty('--announce-ink', inkFor(b.announcement_color));
  } else {
    root.style.removeProperty('--announce-bg');
    root.style.removeProperty('--announce-ink');
  }

  const icon = doc.querySelector('link[rel="icon"]');
  if (icon) {
    if (!icon.dataset.default) icon.dataset.default = icon.getAttribute('href');
    icon.setAttribute('href', b.logo_url || icon.dataset.default);
  }
}

export const instagramUrl = (handle) => (handle ? `https://instagram.com/${encodeURIComponent(handle)}` : null);
export const tiktokUrl = (handle) => (handle ? `https://tiktok.com/@${encodeURIComponent(handle)}` : null);
