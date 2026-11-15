// Tokens de sesión de mentira para los tests de la API: llevan el nivel de verificación
// ("aal1" solo contraseña, "aal2" con código) como los de Supabase.
export const fakeJwt = (key, aal = 'aal2') => `h.${Buffer.from(JSON.stringify({ k: key, aal })).toString('base64url')}.s`;

// El usuario de mentira al que corresponde el token (o el token mismo, si no es un JWT)
export function keyOf(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')).k ?? token;
  } catch {
    return token;
  }
}

// En los tests, "admin" es el administrador con la verificación en dos pasos hecha
export const asToken = (who) => (who === 'admin' ? fakeJwt('admin') : who);
