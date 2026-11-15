import { describe, it, expect } from 'vitest';
import { missingProfileFields, validateSignup, isValidPhone } from './profileCompletion';

const user = (meta = {}, email = 'ana@mail.com') => ({ email, user_metadata: meta });

describe('datos obligatorios de la cuenta', () => {
  it('a quien entra con Google le faltan el teléfono (y el nombre confirmado)', () => {
    expect(missingProfileFields(user({ full_name: 'Ana Pérez' }))).toEqual(['name', 'phone']);
  });

  it('con nombre, teléfono y email reales, está completa', () => {
    expect(missingProfileFields(user({ shipping: { name: 'Ana Pérez', phone: '291 555-1234' } }))).toEqual([]);
  });

  it('el email oculto de Apple no alcanza', () => {
    expect(missingProfileFields(user({ shipping: { name: 'Ana Pérez', phone: '2915551234' } }, 'x1y2@privaterelay.appleid.com'))).toEqual(['email']);
  });

  it('teléfonos: con código de área, con o sin +54', () => {
    expect(isValidPhone('291 555 1234')).toBe(true);
    expect(isValidPhone('+54 9 291 555-1234')).toBe(true);
    expect(isValidPhone('5551234')).toBe(false);
  });
});

describe('registro con email', () => {
  const ok = { name: 'Ana Pérez', phone: '2915551234', email: 'ana@mail.com', password: 'clave-segura', passwordConfirm: 'clave-segura' };
  it('pide la contraseña dos veces e iguales', () => {
    expect(validateSignup(ok)).toEqual({});
    expect(validateSignup({ ...ok, passwordConfirm: 'otra-clave' })).toEqual({ passwordConfirm: 'Las contraseñas no coinciden.' });
  });
  it('pide nombre y apellido, teléfono y una contraseña de 8 o más', () => {
    const errors = validateSignup({ ...ok, name: 'Ana', phone: '123', password: 'corta', passwordConfirm: 'corta' });
    expect(Object.keys(errors).sort()).toEqual(['name', 'password', 'phone']);
  });
});
