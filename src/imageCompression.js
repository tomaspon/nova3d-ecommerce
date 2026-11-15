// Achica las fotos antes de subirlas: una foto de celular (4000 px, ~5 MB) pasa a 1600 px y
// ~150-300 KB, sin diferencia visible en la tienda. Se hace en el navegador, antes de subir.

// Medidas que entran en un cuadrado de `max` px, sin agrandar las chicas
export function fitWithin(width, height, max) {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

// Formatos que no conviene tocar: vectores y animaciones
const KEEP_AS_IS = ['image/svg+xml', 'image/gif'];

/**
 * @param {File} file
 * @param {{ maxSize?: number, quality?: number, keepTransparency?: boolean }} options
 * @returns {Promise<File>} la foto achicada (o la original si no conviene tocarla)
 */
export async function compressImage(file, { maxSize = 1600, quality = 0.82, keepTransparency = false } = {}) {
  if (!file?.type?.startsWith('image/') || KEEP_AS_IS.includes(file.type) || typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // formato que el navegador no sabe leer (p. ej. HEIC en algunos): se sube tal cual
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!keepTransparency) {
    // Las fotos van sobre blanco (un PNG con fondo transparente no queda negro en JPEG)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // WebP pesa menos; Safari viejo no lo genera y devuelve otro formato: ahí se usa JPEG (o PNG si hay transparencia)
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, keepTransparency ? 'image/png' : 'image/jpeg', quality);
  }
  if (!blob || blob.size >= file.size) return file; // ya venía liviana

  const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
  const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([blob], name, { type: blob.type, lastModified: Date.now() });
}
