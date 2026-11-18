// Título, descripción, dirección canónica y datos estructurados (schema.org) de cada página de la tienda.
// Google ejecuta la página: así entiende qué es cada producto (precio, stock, foto) y puede mostrarlo
// con precio en los resultados. Los datos JSON-LD no son código: la política de seguridad no los bloquea.

function upsert(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

export function setPageMeta({ title, description, canonical, jsonLd } = {}) {
  if (typeof document === 'undefined') return;
  if (title) document.title = title;
  if (description) {
    upsert('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }))
      .setAttribute('content', String(description).slice(0, 300));
  }
  if (canonical) {
    upsert('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
      .setAttribute('href', canonical);
  }
  const ld = document.head.querySelector('script[data-page-ld]');
  if (jsonLd) {
    const el = ld || upsert('script[data-page-ld]', () => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.pageLd = '';
      return s;
    });
    el.textContent = JSON.stringify(jsonLd);
  } else if (ld) {
    ld.remove();
  }
}

const absolute = (url) => {
  if (!url) return undefined;
  try { return new URL(url, window.location.origin).toString(); } catch { return undefined; }
};

/** schema.org/Product de un producto de la tienda */
export function productJsonLd(product, store, url) {
  const price = Number(product.price) * (1 - (Number(product.discount) || 0) / 100);
  const images = (product.images?.length ? product.images : [product.imageUrl]).map(absolute).filter(Boolean);
  const inStock = (product.available_stock ?? product.stock ?? 0) > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: String(product.description).slice(0, 500) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.category ? { category: product.category } : {}),
    sku: product.id,
    brand: { '@type': 'Brand', name: store?.name || 'Tienda' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'ARS',
      price: Math.round(price * 100) / 100,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: store?.name || 'Tienda' }
    }
  };
}

/** schema.org/Store de la portada */
export function storeJsonLd(store, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    url,
    ...(store.branding?.logo_url ? { logo: absolute(store.branding.logo_url), image: absolute(store.branding.logo_url) } : {})
  };
}
