import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { validateStoreSignup, TERMS_VERSION } from '../src/storeSignup.js';
import { bearerToken, isPlatformAdmin as hasPlatformAccess } from './_lib/platformAdmin.js';
import { templateDefaults } from './_lib/storeTemplate.js';
import { logApiError } from './_lib/guard.js';

// Alta de tiendas por autoservicio (como Shopify o Tiendanube): quien tiene cuenta crea
// su tienda al instante y queda como dueño. La tienda nace con las ventas deshabilitadas:
// el dueño pide la activación y la plataforma la habilita después de verificarlo.
//
// Acciones (POST, con el token de sesión):
//   create             { name, slug, template, tax_id, whatsapp, sales_channels?, accepted_terms, terms_version }
//   requestActivation  { storeId }

const MAX_STORES_PER_ACCOUNT = 1;
const MAX_STORES_PER_IP_PER_DAY = 3;

const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

async function sessionUser(supabase, req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  if (!hasServiceKey()) return res.status(503).json({ message: 'El alta de tiendas no está disponible en este momento.' });

  try {
    const supabase = getSupabase();
    const user = await sessionUser(supabase, req);
    if (!user) return res.status(401).json({ message: 'Iniciá sesión para crear tu tienda.' });
    const isPlatformAdmin = hasPlatformAccess(user, bearerToken(req));
    const body = req.body || {};

    if (body.action === 'requestActivation') {
      const { data: member } = await supabase.from('store_members')
        .select('store_id').eq('store_id', body.storeId).eq('user_id', user.id).maybeSingle();
      if (!member) return res.status(403).json({ message: 'No administrás esa tienda.' });
      const { error } = await supabase.from('stores')
        .update({ activation_requested_at: new Date().toISOString() }).eq('id', body.storeId);
      if (error) throw error;
      return res.status(200).json({ message: 'Recibimos tu pedido. Te escribimos para verificar tus datos y habilitar las ventas.' });
    }

    if (body.action !== 'create') return res.status(400).json({ message: 'Acción inválida.' });

    const { data, errors } = validateStoreSignup(body);
    if (Object.keys(errors).length > 0) return res.status(400).json({ message: 'Revisá los datos marcados.', errors });

    if (!isPlatformAdmin) {
      const { count: own, error: ownError } = await supabase.from('stores')
        .select('id', { count: 'exact', head: true }).eq('created_by', user.id);
      if (ownError) throw ownError;
      if (own >= MAX_STORES_PER_ACCOUNT) {
        return res.status(409).json({ message: 'Tu cuenta ya tiene una tienda. Entrá a tu panel para seguir armándola.' });
      }

      const ip = clientIp(req);
      if (ip) {
        const since = new Date(Date.now() - 24 * 3600000).toISOString();
        const { count: fromIp, error: ipError } = await supabase.from('stores')
          .select('id', { count: 'exact', head: true }).eq('signup_ip', ip).gte('created_at', since);
        if (ipError) throw ipError;
        if (fromIp >= MAX_STORES_PER_IP_PER_DAY) {
          return res.status(429).json({ message: 'Se crearon varias tiendas desde tu conexión. Probá mañana o escribinos.' });
        }
      }
    }

    // Arranca con el estilo y el envío de la plantilla base (la tienda principal)
    const base = await templateDefaults(supabase);
    const { data: store, error } = await supabase.from('stores').insert({
      branding: base.branding,
      name: data.name,
      slug: data.slug,
      template: data.template,
      sales_enabled: false,
      created_by: user.id,
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
      signup_ip: clientIp(req)
    }).select('id, slug, name, branding').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Ese enlace ya está en uso. Probá con otro.', errors: { slug: 'Ese enlace ya está en uso.' } });
      throw error;
    }

    const [settingsRes, memberRes, detailsRes] = await Promise.all([
      supabase.from('store_settings').insert({ ...base.settings, store_id: store.id, store_name: data.name }),
      supabase.from('store_members').insert({ store_id: store.id, user_id: user.id, role: 'owner' }),
      // Datos del dueño, privados (supabase/016): CUIL/CUIT, WhatsApp y por dónde vende
      supabase.from('store_owner_details').insert({ store_id: store.id, tax_id: data.tax_id, whatsapp: data.whatsapp, sales_channels: data.sales_channels })
    ]);
    if (settingsRes.error || memberRes.error || detailsRes.error) {
      // No dejar tiendas a medias: se deshace todo (la membresía y los datos caen con la tienda)
      await supabase.from('stores').delete().eq('id', store.id);
      throw settingsRes.error || memberRes.error || detailsRes.error;
    }

    return res.status(200).json({ message: '¡Tu tienda está creada!', store });
  } catch (error) {
    console.error('store-signup:', error);
    try { await logApiError(getSupabase(), 'store-signup', error); } catch { /* sin Supabase */ }
    return res.status(500).json({ message: 'No pudimos crear tu tienda. Probá de nuevo en un momento.' });
  }
}
