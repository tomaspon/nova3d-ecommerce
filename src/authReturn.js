// A dónde volver después de un enlace del mail (ver supabaseClient.js). Sin dependencias: se prueba solo.
export function authReturnTarget(location, saved, now = Date.now()) {
  if (!/access_token=|error_description=/.test(location.hash || '')) return null;
  if (!saved?.url || now - saved.at > 7 * 86400000) return null;
  try {
    const target = new URL(saved.url);
    if (target.origin !== location.origin) return null;
    if (target.pathname === location.pathname) return null;
    return `${target.origin}${target.pathname}${target.search}${location.hash}`;
  } catch {
    return null;
  }
}
