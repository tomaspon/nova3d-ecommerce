// Banners de temporada incluidos en la tienda (public/banners). Se eligen desde
// Configuración > Motor de Ofertas, además de poder subir una imagen propia.
// Los motivos están a la derecha porque a la izquierda va el nombre de la campaña.
export const BANNER_PRESETS = [
  { id: 'verano', label: 'Verano', src: '/banners/verano.svg', suggestedName: 'Ofertas de verano' },
  { id: 'primavera', label: 'Primavera', src: '/banners/primavera.svg', suggestedName: 'Llegó la primavera' },
  { id: 'invierno', label: 'Invierno', src: '/banners/invierno.svg', suggestedName: 'Colección invierno' }
];

export const isPresetBanner = (src) => BANNER_PRESETS.some(preset => preset.src === src);
