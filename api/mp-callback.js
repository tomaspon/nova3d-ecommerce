import { getSupabase } from './_lib/payments.js';
import { verifyState } from './_lib/secrets.js';
import { exchangeCode, saveAccount } from './_lib/mercadopago.js';
import { platformUrl } from './_lib/platformAdmin.js';
import { logApiError } from './_lib/guard.js';

// A donde vuelve MercadoPago después de que el vendedor autoriza (GET ?code=...&state=...).
// El state firmado dice qué tienda y qué usuario empezaron la conexión: así nadie puede
// conectar su cuenta a una tienda ajena. Al final se vuelve a Configuración de la tienda,
// en el panel de la plataforma (/panel/<tienda>/configuracion).

function settingsUrl(req, store, result) {
  const params = new URLSearchParams({ mp: result });
  const path = store?.slug ? `/panel/${store.slug}/configuracion` : '/panel';
  return `${platformUrl(req)}${path}?${params}`;
}

export default async function handler(req, res) {
  const { code, state, error: deniedError } = req.query || {};
  const payload = verifyState(state);
  let store = null;

  try {
    const supabase = getSupabase();
    if (payload) {
      const { data } = await supabase.from('stores').select('id, slug, custom_domain').eq('id', payload.s).maybeSingle();
      store = data;
    }
    if (!payload || !store) return res.redirect(302, settingsUrl(req, store, 'invalido'));
    if (deniedError || !code) return res.redirect(302, settingsUrl(req, store, 'cancelado'));

    const tokens = await exchangeCode(String(code));
    await saveAccount(supabase, store.id, tokens, payload.u);
    return res.redirect(302, settingsUrl(req, store, 'conectado'));
  } catch (err) {
    console.error('mp-callback:', err);
    try { await logApiError(getSupabase(), 'mp-callback', err); } catch { /* sin Supabase */ }
    return res.redirect(302, settingsUrl(req, store, 'error'));
  }
}
