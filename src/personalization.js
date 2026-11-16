// Personalización de la tienda con lo que hace cada visitante.
// Lo propio (qué miró, qué le interesa) se guarda solo en su dispositivo, por tienda, y lo puede borrar.
// Lo de todos ("otros también miraron") sale del tráfico anónimo (supabase/015_recomendaciones.sql).

const MAX_SEEN = 12;
const keyFor = (storeId) => `vt_gustos_${storeId}`;
const isEmbedded = () => { try { return window.self !== window.top; } catch { return true; } };

function read(storeId) {
  try {
    const data = JSON.parse(localStorage.getItem(keyFor(storeId)) || 'null');
    if (data && Array.isArray(data.seen) && data.cats && typeof data.cats === 'object') return data;
  } catch { /* dato roto o sin almacenamiento */ }
  return { seen: [], cats: {} };
}

function write(storeId, data) {
  try { localStorage.setItem(keyFor(storeId), JSON.stringify(data)); } catch { /* sin almacenamiento */ }
}

// No se guarda nada desde la vista previa del panel ni desde la tienda encuadrada en la página oficial
const canRemember = (storeId) => Boolean(storeId) && typeof window !== 'undefined' && !isEmbedded();

/** Miró un producto: queda primero en "lo que viste" y suma interés por su categoría */
export function rememberView(storeId, product) {
  if (!canRemember(storeId) || !product?.id) return;
  const data = read(storeId);
  if (data.seen[0] === product.id) return; // recargar la misma ficha no suma interés de nuevo
  data.seen = [product.id, ...data.seen.filter(id => id !== product.id)].slice(0, MAX_SEEN);
  if (product.category) data.cats[product.category] = (data.cats[product.category] || 0) + 1;
  write(storeId, data);
}

/** Lo agregó al carrito: interés más fuerte que solo mirar */
export function rememberCart(storeId, product) {
  if (!canRemember(storeId) || !product?.category) return;
  const data = read(storeId);
  data.cats[product.category] = (data.cats[product.category] || 0) + 3;
  write(storeId, data);
}

export function forgetHistory(storeId) {
  try { localStorage.removeItem(keyFor(storeId)); } catch { /* sin almacenamiento */ }
}

const forSale = (p) => p?.is_active !== false;

/** "Volvé a lo que viste": lo último que miró, en orden, sin el producto que está viendo ahora */
export function recentlyViewed(storeId, products, { exclude = null, limit = 8 } = {}) {
  const byId = new Map(products.map(p => [p.id, p]));
  return read(storeId).seen
    .filter(id => id !== exclude)
    .map(id => byId.get(id))
    .filter(forSale)
    .slice(0, limit);
}

/** "Elegidos para vos": de las categorías que más le interesan, lo que todavía no vio */
export function pickedForYou(storeId, products, { limit = 8 } = {}) {
  const { seen, cats } = read(storeId);
  if (!Object.keys(cats).length) return [];
  const seenSet = new Set(seen);
  return products
    .filter(p => forSale(p) && !seenSet.has(p.id) && cats[p.category] && (p.available_stock ?? p.stock ?? 1) > 0)
    .sort((a, b) => (cats[b.category] - cats[a.category]) || ((Number(b.discount) || 0) - (Number(a.discount) || 0)))
    .slice(0, limit);
}

/** Primero lo que miraron otros visitantes junto a este producto; si no alcanza, de la misma categoría */
export function relatedFor(product, products, alsoViewedIds = [], limit = 4) {
  if (!product) return [];
  const byId = new Map(products.map(p => [p.id, p]));
  const fromTraffic = alsoViewedIds.map(id => byId.get(id)).filter(p => forSale(p) && p.id !== product.id);
  const picked = new Set(fromTraffic.map(p => p.id));
  const sameCategory = products.filter(p => forSale(p) && p.id !== product.id && !picked.has(p.id) && p.category === product.category);
  return [...fromTraffic, ...sameCategory].slice(0, limit);
}

// ---------- Búsqueda tolerante ----------
// Encuentra "remra", "camperas" o "jean azul" aunque el producto diga "Remera" o "Jean Clásico".

export const normalizeText = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ\s]/g, ' ');

// Plural simple del castellano: camperas → campera, pantalones → pantalon
const singular = (w) => (w.length > 4 && w.endsWith('es') && !/[aeiou]es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

function editDistanceAtMost(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

// Qué tan bien una palabra buscada coincide con una palabra del producto (0 = nada)
function wordScore(q, w) {
  if (w === q) return 3;
  if (w.startsWith(q) || singular(w) === singular(q)) return 2.5;
  if (q.length >= 3 && w.includes(q)) return 1.5;
  if (q.length >= 4) {
    const max = q.length >= 7 ? 2 : 1;
    if (editDistanceAtMost(singular(q), singular(w), max)) return 1;
    // También tolera el error al escribir solo el comienzo ("remr" → "remera")
    if (w.length > q.length && editDistanceAtMost(q, w.slice(0, q.length), 1)) return 0.75;
  }
  return 0;
}

const words = (s) => normalizeText(s).split(/\s+/).filter(Boolean);

/** Filtra y ordena por relevancia: todas las palabras buscadas tienen que aparecer (con tolerancia) */
export function searchProducts(products, query) {
  const terms = words(query);
  if (!terms.length) return products;
  const scored = [];
  for (const p of products) {
    const name = words(p.name);
    const rest = words([p.category, p.description, ...(p.variants || []).map(v => v?.name ?? v)].join(' '));
    let total = 0;
    let ok = true;
    for (const t of terms) {
      const inName = Math.max(0, ...name.map(w => wordScore(t, w)));
      const inRest = Math.max(0, ...rest.map(w => wordScore(t, w)));
      const s = Math.max(inName * 2, inRest); // en el nombre pesa el doble
      if (!s) { ok = false; break; }
      total += s;
    }
    if (ok) scored.push({ p, total });
  }
  // Estable: a igual relevancia, se respeta el orden que ya tenía (por ejemplo, el elegido en "Ordenar")
  return scored.map((x, i) => ({ ...x, i })).sort((a, b) => (b.total - a.total) || (a.i - b.i)).map(x => x.p);
}
