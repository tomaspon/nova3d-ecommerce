import crypto from 'node:crypto';

// Cifrado de los tokens de MercadoPago de cada tienda y firma del "state" de OAuth.
// La clave maestra es MP_TOKENS_KEY (en Vercel): 32 bytes en base64.
// Generarla una vez con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

function masterKey() {
  const raw = process.env.MP_TOKENS_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('MP_TOKENS_KEY falta o no tiene 32 bytes en base64.');
  return key;
}

// Una clave distinta para cada uso, derivada de la maestra
const subKey = (purpose) => crypto.createHmac('sha256', masterKey()).update(purpose).digest();

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', subKey('tokens'), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(packed) {
  const [version, iv, tag, data] = String(packed || '').split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Secreto con formato inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', subKey('tokens'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// state de OAuth: tienda, usuario y vencimiento, firmado para que nadie lo pueda armar
export function signState(payload, ttlSeconds = 600) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', subKey('oauth-state')).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', subKey('oauth-state')).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp >= Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
