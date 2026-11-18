// Protecciones comunes de las funciones del servidor:
//  - límite de pedidos por conexión (supabase/016: rate_limit_ok)
//  - registro de errores para el superadmin (supabase/016: app_error_record)
// Si la base todavía no tiene la 016, no bloquean nada: la función sigue andando.

export const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';

/** true si esta conexión ya hizo más de `max` pedidos de este tipo en `seconds` */
export async function overLimit(supabase, req, name, max, seconds) {
  try {
    const { data, error } = await supabase.rpc('rate_limit_ok', { p_bucket: `api:${name}:${clientIp(req)}`, p_max: max, p_seconds: seconds });
    return !error && data === false;
  } catch {
    return false;
  }
}

/** Guarda el error (agrupado si se repite) para verlo en Superadmin › Errores. Nunca lanza. */
export async function logApiError(supabase, source, error, { storeId = null, path = null } = {}) {
  try {
    const message = String(error?.message || error || 'Error').slice(0, 500);
    const detail = String(error?.stack || '').slice(0, 4000) || null;
    await supabase.rpc('app_error_record', {
      p_source: `api/${source}`, p_store_id: storeId, p_path: path, p_message: message, p_detail: detail, p_user_agent: null
    });
  } catch {
    /* el registro de errores nunca rompe la respuesta */
  }
}

/** El origen de la página que llama, solo si es esta misma dirección (o la tienda con su dominio). */
export function trustedOrigin(req, extraHosts = []) {
  const origin = req.headers?.origin;
  if (!origin) return null;
  try {
    const { protocol, host } = new URL(origin);
    const allowed = [req.headers['x-forwarded-host'], req.headers.host, ...extraHosts].filter(Boolean).map(h => String(h).toLowerCase());
    const local = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host);
    return (allowed.includes(host.toLowerCase()) || local) && /^https?:$/.test(protocol) ? `${protocol}//${host}` : null;
  } catch {
    return null;
  }
}
