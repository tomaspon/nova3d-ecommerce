import { describe, it, expect } from 'vitest';
import { summarizeUsers, matchesUserQuery, isBanned } from './adminUsers';

const now = new Date('2026-11-05T12:00:00Z').getTime();

const users = [
  {
    id: 'u1', email: 'Ana@Mail.com', created_at: '2026-01-01', email_confirmed_at: '2026-01-01',
    user_metadata: { shipping: { name: 'Ana Pérez', phone: '291555', document: '30111222', address: { street: 'Mitre', number: '10', city: 'Bahía Blanca', state: 'Buenos Aires' } } },
    app_metadata: { provider: 'email' }
  },
  { id: 'u2', email: 'admin@mail.com', banned_until: '2126-01-01T00:00:00Z', app_metadata: { role: 'admin', provider: 'google' }, user_metadata: { full_name: 'Admin' } }
];

const orders = [
  { user_id: 'u1', customer_email: 'ana@mail.com', status: 'pagado', total: 1000 },
  { user_id: null, customer_email: 'ANA@mail.com', status: 'entregado', total: 500 },
  { user_id: 'u1', customer_email: 'ana@mail.com', status: 'cancelado (tiempo agotado)', total: 9999 },
  { user_id: 'otro', customer_email: 'otro@mail.com', status: 'pagado', total: 7 }
];

describe('summarizeUsers', () => {
  const [ana, admin] = summarizeUsers(users, orders, now);

  it('suma pedidos por sesión y por email, y solo cuenta lo pagado como gasto', () => {
    expect(ana.orderCount).toBe(3);
    expect(ana.paidOrderCount).toBe(2);
    expect(ana.totalSpent).toBe(1500);
  });

  it('toma los datos de envío guardados en el perfil', () => {
    expect(ana.name).toBe('Ana Pérez');
    expect(ana.city).toBe('Bahía Blanca, Buenos Aires');
    expect(ana.address).toBe('Mitre 10');
    expect(ana.emailConfirmed).toBe(true);
  });

  it('marca administradores y cuentas desactivadas', () => {
    expect(admin.isAdmin).toBe(true);
    expect(admin.isDisabled).toBe(true);
    expect(admin.name).toBe('Admin');
    expect(admin.provider).toBe('google');
    expect(ana.isDisabled).toBe(false);
  });
});

describe('isBanned', () => {
  it('un baneo vencido ya no cuenta', () => {
    expect(isBanned({ banned_until: '2020-01-01T00:00:00Z' }, now)).toBe(false);
  });
});

describe('matchesUserQuery', () => {
  const [ana] = summarizeUsers(users, [], now);
  it('busca por nombre, email, teléfono, DNI y ciudad sin importar mayúsculas', () => {
    for (const q of ['ana pé', 'ANA@MAIL', '291555', '30111', 'bahía']) {
      expect(matchesUserQuery(ana, q)).toBe(true);
    }
    expect(matchesUserQuery(ana, 'zzz')).toBe(false);
  });
});
