// Marca de la plataforma (la página oficial que ofrece tiendas online).
// Nombre provisorio: cambiarlo acá alcanza para toda la web.
export const PLATFORM_BRAND = {
  name: 'Vitrina',
  tagline: 'Tu tienda online, lista para vender.'
};

// Dónde vive cada cosa (variables de Vercel; se leen al compilar):
//  - VITE_PLATFORM_DOMAIN: dominio propio de la plataforma (ej. vitrina.com.ar). Ahí va la
//    página oficial, el alta, los paneles y el superadmin; cada tienda queda en <tienda>.vitrina.com.ar.
//  - VITE_PLATFORM_HOST: mientras no haya dominio propio, una dirección aparte solo para la
//    plataforma (ej. vitrina-app.vercel.app). Si está el dominio, no hace falta.
//  - VITE_STORES_ORIGIN: dónde se ven las tiendas sin dominio, con ?tienda= (ej. https://nova3d-ecommerce.vercel.app).
// Sin ninguna (local, o antes de configurarlas) todo convive en la misma dirección.
const env = import.meta.env || {};
export const PLATFORM_DOMAIN = (env.VITE_PLATFORM_DOMAIN || '').toLowerCase();
export const PLATFORM_HOST = (env.VITE_PLATFORM_HOST || PLATFORM_DOMAIN).toLowerCase();
export const STORES_ORIGIN = (env.VITE_STORES_ORIGIN || '').replace(/\/$/, '');

export const isPlatformHost = (hostname, platformHost = PLATFORM_HOST) =>
  Boolean(platformHost) && [platformHost, `www.${platformHost}`].includes((hostname || '').toLowerCase());

const currentHost = () => (typeof window === 'undefined' ? '' : window.location.hostname);
const currentOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

// ¿La plataforma tiene su propia dirección? Entonces las tiendas no muestran nada de la plataforma.
export const hostsAreSplit = () => Boolean(PLATFORM_HOST);
export const onPlatformHost = () => isPlatformHost(currentHost());

// Dirección base de la plataforma y de las tiendas sin dominio
export const platformOrigin = () => (PLATFORM_HOST && !onPlatformHost() ? `https://${PLATFORM_HOST}` : currentOrigin());
export const storesOrigin = () => STORES_ORIGIN || (onPlatformHost() ? '' : currentOrigin());
