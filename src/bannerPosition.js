// El encuadre vertical del banner viaja en el fragmento de la URL (…/banner.jpg#y=35),
// así no hace falta una columna extra en store_settings. 0 = arriba, 50 = centro, 100 = abajo.

export const DEFAULT_BANNER_Y = 50;

export function parseBannerUrl(url) {
  if (!url) return { src: '', y: DEFAULT_BANNER_Y };
  const [src, fragment = ''] = url.split('#');
  const match = fragment.match(/^y=(\d+(?:\.\d+)?)$/);
  const y = match ? Math.min(100, Math.max(0, Number(match[1]))) : DEFAULT_BANNER_Y;
  return { src, y };
}

export function buildBannerUrl(src, y) {
  if (!src) return '';
  const rounded = Math.round(y);
  return rounded === DEFAULT_BANNER_Y ? src : `${src}#y=${rounded}`;
}
