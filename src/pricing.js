// Única fuente de la cuenta de precios. Sirve para productos y para items de una orden
// (ambos tienen price y discount en porcentaje).

export function unitPrice(item) {
  const price = Number(item?.price) || 0;
  const discount = Number(item?.discount) || 0;
  const final = discount > 0 ? price * (1 - discount / 100) : price;
  return Math.round(final * 100) / 100;
}

export function lineTotal(item) {
  return unitPrice(item) * (Number(item?.quantity) || 0);
}

export function itemsTotal(items) {
  return (items || []).reduce((sum, item) => sum + lineTotal(item), 0);
}

// $8.100 — pesos sin centavos, con separador de miles
export function formatMoney(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString('es-AR')}`;
}
