import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { PLATFORM_BRAND } from '../src/platformBrand.js';
import { parseImages } from '../src/productMapping.js';

// Lo que leen los robots, sin tener que correr la página (vercel.json manda acá):
//   ?kind=og&p=/producto/<id>   vista previa al compartir (WhatsApp, Instagram, Facebook, X, Telegram...)
//   ?kind=og&p=/                vista previa de la tienda (o de la página oficial)
//   ?kind=sitemap               sitemap.xml de la tienda de este dominio
//   ?kind=robots                robots.txt
//   ?kind=health                qué configuración está cargada en Vercel (sin revelar valores)
// Comparte función con health para no pasar el límite de 12 funciones de Vercel.

const DEFAULT_SLUG = process.env.VITE_DEFAULT_STORE || 'minimal';
const PLATFORM_HOST = (process.env.VITE_PLATFORM_HOST || process.env.VITE_PLATFORM_DOMAIN || '').toLowerCase();
const PRIVATE_PATHS = ['/panel', '/superadmin', '/plataforma', '/admin', '/api/', '/crear', '/ingresar', '/perfil', '/login', '/seguimiento'];

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const hostOf = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
const originOf = (req) => `${req.headers['x-forwarded-proto'] || 'https'}://${hostOf(req)}`;
const isPlatformHost = (host) => Boolean(PLATFORM_HOST) && [PLATFORM_HOST, `www.${PLATFORM_HOST}`].includes(host.replace(/:\d+$/, ''));
const absolute = (url, origin) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`);

/** HTML mínimo con las etiquetas que leen las vistas previas */
export function buildOgHtml({ title, description, image, url, siteName, type = 'website', price = null }) {
  const tags = [
    ['og:type', type], ['og:site_name', siteName], ['og:title', title], ['og:description', description],
    ['og:url', url], ['og:image', image], ['og:locale', 'es_AR'],
    ['product:price:amount', price != null ? String(Math.round(price)) : ''], ['product:price:currency', price != null ? 'ARS' : '']
  ].filter(([, v]) => v);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
${tags.map(([p, v]) => `<meta property="${p}" content="${escapeHtml(v)}">`).join('\n')}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
</head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></body></html>`;
}

async function storeFor(supabase, req) {
  const host = hostOf(req);
  const rpc = async (fn, args) => {
    const { data, error } = await supabase.rpc(fn, args);
    return error ? null : data;
  };
  const byHost = await rpc('get_store_by_host', { p_host: host });
  if (byHost) return byHost;
  const slug = String(req.query?.tienda || '').trim().toLowerCase() || DEFAULT_SLUG;
  return (await rpc('get_store_by_slug', { p_slug: slug === 'demo' ? DEFAULT_SLUG : slug }))
    || (await rpc('get_store_by_slug', { p_slug: DEFAULT_SLUG }));
}

async function og(req, res) {
  const origin = originOf(req);
  const path = String(req.query?.p || '/');
  const tienda = req.query?.tienda ? `?tienda=${encodeURIComponent(req.query.tienda)}` : '';

  // La página oficial (en su dirección propia)
  if (isPlatformHost(hostOf(req)) && !path.startsWith('/producto/')) {
    return send(res, buildOgHtml({ title: `${PLATFORM_BRAND.name} | ${PLATFORM_BRAND.tagline}`, description: 'Creá tu tienda online gratis: catálogo, cobros con MercadoPago, envíos y un panel simple.', url: `${origin}${path}`, siteName: PLATFORM_BRAND.name, image: '' }));
  }

  const supabase = getSupabase();
  const store = await storeFor(supabase, req);
  const storeName = store?.name || 'Tienda online';
  const logo = absolute(store?.branding?.logo_url, origin);
  const productId = /^\/producto\/([0-9a-f-]{36})$/i.exec(path)?.[1];

  if (productId && store?.id) {
    const { data: p } = await supabase.from('products')
      .select('id, name, price, discount, image_url, description, stock')
      .eq('id', productId).eq('store_id', store.id).eq('is_active', true).maybeSingle();
    if (p) {
      const final = Number(p.price) * (1 - (Number(p.discount) || 0) / 100);
      const priceText = p.discount > 0 ? `${money(final)} (antes ${money(p.price)}, ${p.discount}% OFF)` : money(final);
      const about = String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      return send(res, buildOgHtml({
        title: `${p.name} · ${storeName}`,
        description: `${priceText}${Number(p.stock) <= 0 ? ' · Agotado' : ''}${about ? ` · ${about}` : ''}`,
        image: absolute(parseImages(p.image_url)[0], origin) || logo,
        url: `${origin}/producto/${p.id}${tienda}`,
        siteName: storeName,
        type: 'product',
        price: final
      }));
    }
  }

  const tagline = store?.branding?.tagline || store?.branding?.about_text || `Comprá online en ${storeName}: pagá con MercadoPago o transferencia y seguí tu pedido.`;
  return send(res, buildOgHtml({ title: storeName, description: String(tagline).slice(0, 200), image: logo, url: `${origin}/${tienda}`, siteName: storeName }));
}

function send(res, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}

async function sitemap(req, res) {
  const origin = originOf(req);
  const urls = [];
  if (isPlatformHost(hostOf(req))) {
    urls.push(`${origin}/`, `${origin}/terminos`);
  } else {
    const supabase = getSupabase();
    const store = await storeFor(supabase, req);
    urls.push(`${origin}/`, `${origin}/nosotros`);
    if (store?.id) {
      const { data } = await supabase.from('products').select('id').eq('store_id', store.id).eq('is_active', true).limit(5000);
      for (const p of data || []) urls.push(`${origin}/producto/${p.id}`);
    }
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n')}
</urlset>`);
}

export function robotsTxt(origin) {
  return ['User-agent: *', 'Allow: /', ...PRIVATE_PATHS.map(p => `Disallow: ${p}`), '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}

export default async function handler(req, res) {
  const kind = String(req.query?.kind || 'health');
  try {
    if (kind === 'robots') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(robotsTxt(originOf(req)));
    }
    if (kind === 'og') return await og(req, res);
    if (kind === 'sitemap') return await sitemap(req, res);
    return res.status(200).json({
      serviceRoleKey: hasServiceKey(),
      mercadoPago: Boolean(process.env.MP_ACCESS_TOKEN),
      email: Boolean(process.env.RESEND_API_KEY && process.env.STORE_EMAIL_SENDER)
    });
  } catch (error) {
    console.error('seo:', error);
    // Ante cualquier problema, una vista previa genérica (nunca un error para el robot)
    return send(res, buildOgHtml({ title: 'Tienda online', description: 'Comprá online fácil y seguro.', url: originOf(req), siteName: 'Tienda online', image: '' }));
  }
}
