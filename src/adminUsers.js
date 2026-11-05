import { isPaid } from './orderStatus.js';

// Gestión de usuarios del panel. Lo usa la función del servidor (api/admin-users.js) para
// armar la lista que ve el administrador, y el panel para filtrarla.

// "Desactivar" en Supabase es un baneo: con 100 años alcanza para que sea indefinido.
export const DISABLE_BAN_DURATION = '876000h';

export const isBanned = (user, now = Date.now()) =>
  Boolean(user?.banned_until) && new Date(user.banned_until).getTime() > now;

// Pedidos y gasto por cuenta: cuentan los pedidos hechos con la sesión iniciada (user_id)
// y los que se hicieron con el mismo email sin iniciar sesión.
export function summarizeUsers(users, orders = [], now = Date.now()) {
  return users.map(user => {
    const email = (user.email || '').toLowerCase();
    const own = orders.filter(o => o.user_id === user.id || (email && (o.customer_email || '').toLowerCase() === email));
    const paid = own.filter(o => isPaid(o.status));
    const shipping = user.user_metadata?.shipping || {};
    const address = shipping.address || {};

    return {
      id: user.id,
      email: user.email || '',
      name: shipping.name || user.user_metadata?.full_name || user.user_metadata?.name || '',
      phone: shipping.phone || user.phone || '',
      document: shipping.document || '',
      city: [address.city, address.state].filter(Boolean).join(', '),
      address: address.street ? `${address.street} ${address.number || ''}`.trim() : '',
      provider: user.app_metadata?.provider || 'email',
      isAdmin: user.app_metadata?.role === 'admin',
      isDisabled: isBanned(user, now),
      emailConfirmed: Boolean(user.email_confirmed_at),
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
      orderCount: own.length,
      paidOrderCount: paid.length,
      totalSpent: paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    };
  });
}

// Búsqueda del panel: nombre, email, teléfono, DNI o ciudad
export function matchesUserQuery(user, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [user.name, user.email, user.phone, user.document, user.city]
    .some(value => (value || '').toLowerCase().includes(q));
}
