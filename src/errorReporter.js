import { supabase } from './supabaseClient';

// Avisa al superadmin de los errores que ven los visitantes (supabase/016: log_client_error).
// Solo el mensaje, el detalle técnico y la página (sin la parte de ?búsqueda); nunca datos de la persona.
// Como mucho 8 por carga de página, sin repetir, y nada en desarrollo.

let context = { storeId: null };
let sent = 0;
const seen = new Set();

// Errores que no son nuestros o que no se pueden arreglar (extensiones, conexión del visitante...)
const IGNORE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection|Load failed|Failed to fetch|NetworkError|AbortError|chrome-extension:|moz-extension:|safari-extension:/i;

export const setErrorContext = (next) => { context = { ...context, ...next }; };

export function shouldReport(message, stack = '') {
  return Boolean(message) && !IGNORE.test(message) && !IGNORE.test(stack);
}

export function reportError(error, extra = '') {
  try {
    if (import.meta.env?.DEV) return;
    const message = String(error?.message || error || '').trim().slice(0, 500);
    const stack = String(error?.stack || '');
    if (!shouldReport(message, stack) || seen.has(message) || sent >= 8) return;
    seen.add(message);
    sent += 1;
    const detail = [stack, extra].filter(Boolean).join('\n').slice(0, 3500) || null;
    supabase.rpc('log_client_error', {
      p_store_id: context.storeId || null,
      p_path: window.location.pathname.slice(0, 300),
      p_message: message,
      p_detail: detail
    }).then(() => {}, () => {});
  } catch {
    /* avisar de un error nunca puede causar otro */
  }
}

export function installErrorReporter() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => reportError(event.error || event.message, event.filename ? `${event.filename}:${event.lineno}` : ''));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
