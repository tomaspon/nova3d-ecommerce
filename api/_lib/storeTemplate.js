// Plantilla base de la plataforma: la tienda principal (MINIMAL) es el modelo del que parte
// cada tienda nueva (y el estilo que muestra la tienda de ejemplo de la página oficial).
// Se copia solo el ESTILO y el costo de envío, nunca lo propio de esa marca
// (logo, textos, redes, campaña, datos de cobro o de contacto).
import { DEFAULT_STORE_ID } from '../../src/storeIds.js';
import { templateStyle } from '../../src/branding.js';

export async function templateDefaults(supabase, baseId = DEFAULT_STORE_ID) {
  const [{ data: base }, { data: settings }] = await Promise.all([
    supabase.from('stores').select('branding').eq('id', baseId).maybeSingle(),
    supabase.from('store_settings').select('*').eq('store_id', baseId).maybeSingle()
  ]);
  return {
    branding: templateStyle(base?.branding),
    settings: settings?.shipping_cost != null ? { shipping_cost: settings.shipping_cost } : {}
  };
}
