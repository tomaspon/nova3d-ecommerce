import { getSupabase, hasServiceKey } from './_lib/payments.js';
import { requirePlatformAdmin, listAllUsers, siteUrl } from './_lib/platformAdmin.js';
import { isVercelConfigured, addDomain, removeDomain, domainStatus } from './_lib/vercelDomains.js';
import { STORE_TEMPLATES, slugError, normalizeDomain, isValidDomain } from '../src/platformStores.js';
import { DEFAULT_STORE_ID } from '../src/storeIds.js';
import { isPaid } from '../src/orderStatus.js';

// Panel de plataforma: listar tiendas, crearlas, suspenderlas, asignar dueños y dominios.
// Crear tiendas y cambiar estado, slug o dominio no se puede desde el navegador
// (supabase/003_multitienda.sql): pasa por acá, con la service role key y solo para
// el administrador de la plataforma.

const ACTIONS = ['create', 'update', 'setDomain', 'addOwner', 'removeOwner'];

class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function findOrInviteUser(supabase, email, redirectTo) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new UserError('El email no es válido.');

  const existing = (await listAllUsers(supabase)).find(u => (u.email || '').toLowerCase() === normalized);
  if (existing) return { user: existing, invited: false };

  // Sin cuenta todavía: Supabase le manda una invitación para crear su contraseña
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalized, { redirectTo });
  if (error) {
    const tooMany = error.status === 429 || /rate limit/i.test(error.message);
    throw new UserError(tooMany ? 'Se enviaron demasiados mails seguidos. Probá en un rato.' : 'No se pudo invitar a ese email.', tooMany ? 429 : 400);
  }
  return { user: data.user, invited: true };
}

async function addOwner(supabase, req, store, email) {
  const { user, invited } = await findOrInviteUser(supabase, email, `${siteUrl(req)}/admin?tienda=${store.slug}`);
  const { error } = await supabase.from('store_members')
    .upsert({ store_id: store.id, user_id: user.id, role: 'owner' }, { onConflict: 'store_id,user_id' });
  if (error) throw error;
  return invited
    ? `Invitamos a ${user.email}: le llega un mail para crear su contraseña.`
    : `${user.email} ya puede administrar ${store.name}.`;
}

async function getStore(supabase, storeId) {
  if (typeof storeId !== 'string' || !storeId) throw new UserError('Falta la tienda.');
  const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).maybeSingle();
  if (error) throw error;
  if (!data) throw new UserError('No existe esa tienda.', 404);
  return data;
}

async function listStores(supabase) {
  const [storesRes, productsRes, ordersRes, membersRes] = await Promise.all([
    supabase.from('stores').select('*').order('created_at'),
    supabase.from('products').select('store_id, is_active'),
    supabase.from('orders').select('store_id, status, total'),
    supabase.from('store_members').select('store_id, user_id, role')
  ]);
  for (const r of [storesRes, productsRes, ordersRes, membersRes]) if (r.error) throw r.error;

  const userIds = [...new Set(membersRes.data.map(m => m.user_id))];
  const users = await Promise.all(userIds.map(id => supabase.auth.admin.getUserById(id)));
  const emailById = Object.fromEntries(users.map((r, i) => [userIds[i], r.data?.user?.email || '']));

  return Promise.all(storesRes.data.map(async (store) => {
    const paid = ordersRes.data.filter(o => o.store_id === store.id && isPaid(o.status));
    return {
      ...store,
      isDefault: store.id === DEFAULT_STORE_ID,
      productCount: productsRes.data.filter(p => p.store_id === store.id && p.is_active).length,
      paidOrderCount: paid.length,
      revenue: paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      owners: membersRes.data
        .filter(m => m.store_id === store.id)
        .map(m => ({ userId: m.user_id, email: emailById[m.user_id], role: m.role })),
      domain: store.custom_domain ? await domainStatus(store.custom_domain).catch(() => ({ status: 'unknown' })) : null
    };
  }));
}

export default async function handler(req, res) {
  if (!hasServiceKey()) {
    return res.status(503).json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
  }

  try {
    const supabase = getSupabase();
    const admin = await requirePlatformAdmin(supabase, req);
    if (!admin) return res.status(401).json({ message: 'Solo para el administrador de la plataforma.' });

    if (req.method === 'GET') {
      return res.status(200).json({
        stores: await listStores(supabase),
        vercelConfigured: isVercelConfigured(),
        platformDomain: process.env.PLATFORM_DOMAIN || null
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const body = req.body || {};
    if (!ACTIONS.includes(body.action)) throw new UserError('Acción inválida.');

    if (body.action === 'create') {
      const name = String(body.name || '').trim();
      const slug = String(body.slug || '').trim();
      const template = STORE_TEMPLATES.some(t => t.id === body.template) ? body.template : 'general';
      if (!name || name.length > 60) throw new UserError('El nombre es obligatorio (hasta 60 caracteres).');
      const invalidSlug = slugError(slug);
      if (invalidSlug) throw new UserError(invalidSlug);

      // Plantilla: otra tienda de la que se copian la marca y la configuración (envío, campaña,
      // banner). Los productos, pedidos y dueños no se copian: la tienda nueva arranca vacía.
      let base = null;
      let baseSettings = {};
      if (body.copyFrom) {
        base = await getStore(supabase, body.copyFrom);
        const { data, error } = await supabase.from('store_settings').select('*').eq('store_id', base.id).maybeSingle();
        if (error) throw error;
        if (data) {
          baseSettings = {
            shipping_cost: data.shipping_cost,
            campaign_active: data.campaign_active,
            campaign_name: data.campaign_name,
            campaign_image_url: data.campaign_image_url
          };
        }
      }

      const { data: store, error } = await supabase.from('stores')
        .insert({ name, slug, template, branding: base?.branding || {} })
        .select().single();
      if (error) {
        if (error.code === '23505') throw new UserError('Ya existe una tienda con ese enlace. Elegí otro.', 409);
        throw error;
      }
      const { error: settingsError } = await supabase.from('store_settings').insert({ ...baseSettings, store_id: store.id, store_name: name });
      if (settingsError) throw settingsError;

      let message = base ? `Tienda "${name}" creada con la configuración de ${base.name}.` : `Tienda "${name}" creada.`;
      if (String(body.ownerEmail || '').trim()) {
        message += ' ' + await addOwner(supabase, req, store, String(body.ownerEmail));
      }
      return res.status(200).json({ message, storeId: store.id });
    }

    const store = await getStore(supabase, body.storeId);

    if (body.action === 'update') {
      const changes = {};
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name || name.length > 60) throw new UserError('El nombre es obligatorio (hasta 60 caracteres).');
        changes.name = name;
      }
      if (body.status !== undefined) {
        if (!['active', 'suspended'].includes(body.status)) throw new UserError('Estado inválido.');
        // La tienda por defecto es la que se muestra cuando el dominio no coincide con ninguna
        if (store.id === DEFAULT_STORE_ID && body.status === 'suspended') {
          throw new UserError('La tienda principal de la plataforma no se puede suspender.');
        }
        changes.status = body.status;
      }
      if (Object.keys(changes).length === 0) throw new UserError('No hay cambios.');
      const { error } = await supabase.from('stores').update(changes).eq('id', store.id);
      if (error) throw error;
      return res.status(200).json({
        message: changes.status === 'suspended' ? 'Tienda suspendida.' : changes.status === 'active' ? 'Tienda reactivada.' : 'Cambios guardados.'
      });
    }

    if (body.action === 'setDomain') {
      const domain = normalizeDomain(body.domain);
      if (domain && !isValidDomain(domain)) throw new UserError('Ese dominio no es válido. Ejemplo: velasluna.com.ar');
      if (domain === store.custom_domain) return res.status(200).json({ message: 'Sin cambios.' });

      if (domain) {
        try {
          await addDomain(domain);
        } catch (vercelError) {
          throw new UserError(`Vercel no aceptó el dominio: ${vercelError.message}`);
        }
      }
      const { error } = await supabase.from('stores').update({ custom_domain: domain || null }).eq('id', store.id);
      if (error) {
        if (domain) await removeDomain(domain);
        if (error.code === '23505') throw new UserError('Ese dominio ya lo usa otra tienda.', 409);
        throw error;
      }
      await removeDomain(store.custom_domain);
      return res.status(200).json({ message: domain ? `Dominio ${domain} guardado.` : 'Dominio quitado.' });
    }

    if (body.action === 'addOwner') {
      return res.status(200).json({ message: await addOwner(supabase, req, store, String(body.email || '')) });
    }

    if (body.action === 'removeOwner') {
      const { error } = await supabase.from('store_members').delete().eq('store_id', store.id).eq('user_id', body.userId);
      if (error) throw error;
      return res.status(200).json({ message: 'Ya no administra esta tienda.' });
    }
  } catch (error) {
    if (error instanceof UserError) return res.status(error.status).json({ message: error.message });
    console.error('platform-stores:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
}
