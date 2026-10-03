// image_url guarda una URL sola o un arreglo JSON de URLs (productos con varias fotos)
export function parseImages(imageUrl) {
  if (!imageUrl) return [];
  if (!imageUrl.startsWith('[')) return [imageUrl];
  try {
    const parsed = JSON.parse(imageUrl);
    return Array.isArray(parsed) ? parsed : [imageUrl];
  } catch {
    return [imageUrl];
  }
}

// Fila de la base → producto como lo usa la app.
// stock = lo que hay físicamente (on hand); reserved_stock = unidades en órdenes sin pagar;
// available_stock = lo que todavía se puede vender.
export function mapProduct(row, reservedMap = {}) {
  const images = parseImages(row.image_url);
  const reserved = reservedMap[row.id] || 0;
  return {
    ...row,
    imageUrl: images[0] || null,
    images,
    isActive: row.is_active,
    reserved_stock: reserved,
    available_stock: Math.max(0, Number(row.stock) - reserved)
  };
}
