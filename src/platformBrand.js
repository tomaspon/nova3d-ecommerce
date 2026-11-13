// Marca de la plataforma (la página oficial que ofrece tiendas online).
// Nombre provisorio: cambiarlo acá alcanza para toda la web.
export const PLATFORM_BRAND = {
  name: 'Vitrina',
  tagline: 'Tu tienda online, lista para vender.'
};

// Dominio de la plataforma (VITE_PLATFORM_DOMAIN en Vercel, ej: vitrina.com.ar).
// En ese dominio se muestra la página oficial; cada tienda vive en su subdominio o dominio propio.
// Sin definir, la dirección principal sigue mostrando la tienda por defecto.
export const PLATFORM_DOMAIN = (import.meta.env?.VITE_PLATFORM_DOMAIN || '').toLowerCase();

export const isPlatformHost = (hostname, platformDomain = PLATFORM_DOMAIN) =>
  Boolean(platformDomain) && [platformDomain, `www.${platformDomain}`].includes((hostname || '').toLowerCase());
