// Datos mínimos de toda cuenta: nombre, email y teléfono. Quien entra con Google, Apple, etc.
// no siempre los trae (Apple puede ocultar el email, ninguno da el teléfono): se le piden al entrar.
// Se guardan en user_metadata.shipping, donde ya los leen el perfil y el checkout.

export const MIN_PASSWORD_LENGTH = 8;

export const profileOf = (user) => {
  const shipping = user?.user_metadata?.shipping || {};
  const meta = user?.user_metadata || {};
  return {
    name: shipping.name || meta.full_name || meta.name || '',
    phone: shipping.phone || user?.phone || '',
    email: user?.email || ''
  };
};

// Solo dígitos; acepta +54, espacios y guiones. Celular argentino: 10 dígitos (sin 0 ni 15) o con 54/549 adelante.
export const cleanPhone = (value) => String(value || '').replace(/\D/g, '');
export const isValidPhone = (value) => {
  const digits = cleanPhone(value);
  return digits.length >= 10 && digits.length <= 13;
};

export const isValidName = (value) => String(value || '').trim().split(/\s+/).filter(w => w.length >= 2).length >= 2;
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

// Las direcciones privadas de Apple ("ocultar mi email") sirven para escribirle, pero conviene pedir una real
export const isRelayEmail = (email) => /@privaterelay\.appleid\.com$/i.test(email || '');

export function missingProfileFields(user) {
  if (!user) return [];
  const p = profileOf(user);
  const missing = [];
  if (!isValidName(p.name) || !user.user_metadata?.shipping?.name) missing.push('name');
  if (!isValidPhone(p.phone)) missing.push('phone');
  // Si ya cargó un email nuevo, alcanza con que esté pendiente de confirmar
  const email = isValidEmail(user.new_email) && !isRelayEmail(user.new_email) ? user.new_email : p.email;
  if (!isValidEmail(email) || isRelayEmail(email)) missing.push('email');
  return missing;
}

export const needsProfile = (user) => missingProfileFields(user).length > 0;

// Validación del registro con email: los mismos datos, más la contraseña dos veces
export function validateSignup({ name, phone, email, password, passwordConfirm }) {
  const errors = {};
  if (!isValidName(name)) errors.name = 'Escribí tu nombre y apellido.';
  if (!isValidPhone(phone)) errors.phone = 'Escribí tu celular con código de área (ej: 291 555 1234).';
  if (!isValidEmail(email)) errors.email = 'Revisá el email.';
  if ((password || '').length < MIN_PASSWORD_LENGTH) errors.password = `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  else if (password !== passwordConfirm) errors.passwordConfirm = 'Las contraseñas no coinciden.';
  return errors;
}
