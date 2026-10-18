// Banners de campaña ilustrados, pensados para vender: saludo en letra script, titular grande,
// oferta real y botón de compra, rodeados de objetos de la temporada (components/campaignArt.jsx).
// Se eligen desde Configuración > Motor de Ofertas, además de poder subir una imagen propia.
// En la base se guardan como "preset:<id>" dentro de campaign_image_url.

export const BANNER_PRESETS = [
  {
    id: 'verano',
    label: 'Verano',
    kicker: 'Hello',
    defaultTitle: 'Summer Sale',
    colors: {
      bg: '#FFD43B', glow: '#FFF1A6', confetti: 'rgba(255,255,255,0.55)',
      title: '#1D2B53', script: '#D6246E', offer: '#1D2B53',
      ctaBg: '#D6246E', ctaText: '#FFFFFF'
    }
  },
  {
    id: 'primavera',
    label: 'Primavera',
    kicker: 'Welcome',
    defaultTitle: 'Spring Sale',
    colors: {
      bg: '#FCE4EC', glow: '#FFFFFF', confetti: 'rgba(236,72,153,0.18)',
      title: '#24442B', script: '#C2185B', offer: '#24442B',
      ctaBg: '#2E7D32', ctaText: '#FFFFFF'
    }
  },
  {
    id: 'invierno',
    label: 'Invierno',
    kicker: 'Cozy',
    defaultTitle: 'Winter Sale',
    colors: {
      bg: '#14223F', glow: '#2B4A7E', confetti: 'rgba(255,255,255,0.35)',
      title: '#FFFFFF', script: '#8FD3FF', offer: '#FFFFFF',
      ctaBg: '#FFFFFF', ctaText: '#14223F'
    }
  }
];

const PREFIX = 'preset:';

export const presetValue = (preset) => `${PREFIX}${preset.id}`;

export function findPreset(value) {
  if (!value || !value.startsWith(PREFIX)) return null;
  return BANNER_PRESETS.find(preset => preset.id === value.slice(PREFIX.length)) || null;
}

export const isPresetBanner = (value) => Boolean(findPreset(value));

// Los títulos por defecto de los presets: si la campaña tiene uno de estos, al cambiar
// de preset se reemplaza por el del nuevo (si lo escribió el admin, se respeta).
export const isDefaultTitle = (title) =>
  !title?.trim() || BANNER_PRESETS.some(preset => preset.defaultTitle.toLowerCase() === title.trim().toLowerCase());
