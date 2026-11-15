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

// Clave de las reservas por opción (talle, color...): "<productId>::<opción>"
export const variantKey = (productId, variant) => `${productId}::${variant}`;

// Opciones del producto (supabase/011_talles.sql): [{ name, stock }] → con lo disponible de cada una
function mapVariants(row, reservedMap) {
  const list = Array.isArray(row.variants) ? row.variants : [];
  return list
    .filter(v => v && String(v.name || '').trim())
    .map(v => {
      const stock = Math.max(0, Number(v.stock) || 0);
      const reserved = reservedMap[variantKey(row.id, v.name)] || 0;
      return { name: String(v.name), stock, reserved, available: Math.max(0, stock - reserved) };
    });
}

// Fila de la base → producto como lo usa la app.
// stock = lo que hay físicamente (on hand); reserved_stock = unidades en órdenes sin pagar;
// available_stock = lo que todavía se puede vender. Con opciones, cada una tiene lo suyo.
export function mapProduct(row, reservedMap = {}) {
  const images = parseImages(row.image_url);
  const reserved = reservedMap[row.id] || 0;
  const variants = mapVariants(row, reservedMap);
  const available = variants.length
    ? variants.reduce((sum, v) => sum + v.available, 0)
    : Math.max(0, Number(row.stock) - reserved);
  return {
    ...row,
    imageUrl: images[0] || null,
    images,
    isActive: row.is_active,
    variants,
    variantLabel: row.variant_label || 'Talle',
    reserved_stock: reserved,
    available_stock: available
  };
}

// Lo que se puede vender de una opción (o del producto, si no tiene opciones)
export function availableFor(product, variant) {
  if (!product?.variants?.length) return product?.available_stock ?? 0;
  return product.variants.find(v => v.name === variant)?.available ?? 0;
}

// Cada renglón del carrito es un producto + opción: la misma remera en S y en M son dos renglones
export const cartKey = (item) => item.cartKey || (item.variant ? variantKey(item.id, item.variant) : item.id);
