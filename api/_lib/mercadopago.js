import { encryptSecret, decryptSecret } from './secrets.js';
import { DEFAULT_STORE_ID } from '../../src/storeIds.js';

// Conexión de la cuenta de MercadoPago de cada tienda (OAuth) y elección de la cuenta con
// la que se cobra. Documentación: mercadopago.com.ar/developers/es/docs/security/oauth
//
// Variables en Vercel:
//   MP_APP_ID, MP_CLIENT_SECRET  datos de la aplicación de la plataforma en MercadoPago Developers
//   MP_REDIRECT_URI              https://<dominio>/api/mp-callback (igual a la cargada en la aplicación)
//   MP_TOKENS_KEY                clave para cifrar los tokens (ver api/_lib/secrets.js)
//   PLATFORM_FEE_PERCENT         comisión de la plataforma por venta (opcional, ej: 3)
//   MP_ACCESS_TOKEN              cuenta de la plataforma: la usa la tienda principal mientras no conecte la suya

const AUTH_URL = 'https://auth.mercadopago.com/authorization';
const TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const RENEW_BEFORE_DAYS = 15;

export const isMpOAuthConfigured = () =>
  Boolean(process.env.MP_APP_ID && process.env.MP_CLIENT_SECRET && process.env.MP_REDIRECT_URI && process.env.MP_TOKENS_KEY);

export function authorizationUrl(state) {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', process.env.MP_APP_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', process.env.MP_REDIRECT_URI);
  return url.toString();
}

async function tokenRequest(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: process.env.MP_APP_ID, client_secret: process.env.MP_CLIENT_SECRET, ...body })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`MercadoPago rechazó la autorización (${data.error || response.status}).`);
  }
  return data;
}

export const exchangeCode = (code) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: process.env.MP_REDIRECT_URI });

const refreshTokens = (refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

// Guarda (o reemplaza) la cuenta conectada de una tienda, con los tokens cifrados
export async function saveAccount(supabase, storeId, tokens, userId) {
  const row = {
    store_id: storeId,
    provider: 'mercadopago',
    mp_user_id: tokens.user_id != null ? String(tokens.user_id) : null,
    access_token_enc: encryptSecret(tokens.access_token),
    refresh_token_enc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    public_key: tokens.public_key || null,
    live_mode: tokens.live_mode ?? null,
    expires_at: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
    ...(userId ? { connected_by: userId, connected_at: new Date().toISOString() } : {})
  };
  const { error } = await supabase.from('store_payment_accounts').upsert(row, { onConflict: 'store_id' });
  if (error) throw error;
  const { error: flagError } = await supabase.from('stores').update({ mp_connected: true }).eq('id', storeId);
  if (flagError) throw flagError;
}

export async function disconnectAccount(supabase, storeId) {
  const { error } = await supabase.from('store_payment_accounts').delete().eq('store_id', storeId);
  if (error) throw error;
  const { error: flagError } = await supabase.from('stores').update({ mp_connected: false }).eq('id', storeId);
  if (flagError) throw flagError;
}

// Token con el que se cobra para una tienda:
//   - su cuenta conectada (se renueva sola si está por vencer), o
//   - la cuenta de la plataforma, solo para la tienda principal, o
//   - null: la tienda no puede cobrar con MercadoPago.
export async function getStoreMpToken(supabase, storeId) {
  const { data: account, error } = await supabase.from('store_payment_accounts')
    .select('*').eq('store_id', storeId).maybeSingle();
  // Sin la migración 008 la tabla no existe todavía: se sigue como antes (cuenta de la plataforma)
  const tableMissing = error && (error.code === '42P01' || error.code === 'PGRST205');
  if (error && !tableMissing) throw error;

  if (account) {
    const expiresSoon = account.expires_at
      && new Date(account.expires_at).getTime() - Date.now() < RENEW_BEFORE_DAYS * 86400000;
    if (expiresSoon && account.refresh_token_enc) {
      try {
        const tokens = await refreshTokens(decryptSecret(account.refresh_token_enc));
        await saveAccount(supabase, storeId, tokens);
        return { token: tokens.access_token, source: 'seller' };
      } catch (refreshError) {
        console.error(`No se pudo renovar el token de MercadoPago de la tienda ${storeId}:`, refreshError);
      }
    }
    return { token: decryptSecret(account.access_token_enc), source: 'seller' };
  }

  if (storeId === DEFAULT_STORE_ID && process.env.MP_ACCESS_TOKEN) {
    return { token: process.env.MP_ACCESS_TOKEN, source: 'platform' };
  }
  return null;
}

// Comisión de la plataforma por venta, en pesos (solo con cuentas de vendedores)
export function platformFee(total) {
  const percent = Number(process.env.PLATFORM_FEE_PERCENT) || 0;
  if (percent <= 0) return 0;
  return Math.round(Number(total) * percent) / 100;
}
