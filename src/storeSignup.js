import { STORE_TEMPLATES, slugError, slugify } from './platformStores.js';
import { TERMS_VERSION, isValidCuit } from './storeRequest.js';
import { cleanPhone, isValidPhone } from './profileCompletion.js';

// Alta de tienda por autoservicio: reglas compartidas por el asistente y el servidor
// (api/store-signup.js).

export { TERMS_VERSION, slugify };

// Por dónde vende hoy (opcional, como la encuesta de Tiendanube): ordena qué le mostramos primero
export const SALES_CHANNELS = [
  { id: 'instagram', label: 'Instagram o Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'local', label: 'Local propio' },
  { id: 'ferias', label: 'Ferias o eventos' },
  { id: 'marketplaces', label: 'Mercado Libre u otros' },
  { id: 'ninguno', label: 'Todavía no vendo' }
];

const clean = (value, max) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function validateStoreSignup(input = {}) {
  const data = {
    name: clean(input.name, 60),
    slug: clean(input.slug, 40).toLowerCase(),
    template: clean(input.template, 20),
    tax_id: String(input.tax_id ?? '').replace(/\D/g, ''),
    whatsapp: cleanPhone(input.whatsapp),
    sales_channels: [...new Set((Array.isArray(input.sales_channels) ? input.sales_channels : []).map(String))]
      .filter(id => SALES_CHANNELS.some(c => c.id === id))
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Poné el nombre de tu tienda.';
  const invalidSlug = slugError(data.slug);
  if (invalidSlug) errors.slug = invalidSlug;
  if (!STORE_TEMPLATES.some(t => t.id === data.template)) errors.template = 'Elegí el rubro.';
  if (!isValidCuit(data.tax_id)) errors.tax_id = 'Ingresá un CUIL o CUIT válido (11 números).';
  if (!isValidPhone(data.whatsapp)) errors.whatsapp = 'Ingresá tu WhatsApp con código de área (ej: 11 2345 6789).';
  if (!input.accepted_terms || input.terms_version !== TERMS_VERSION) {
    errors.accepted_terms = 'Tenés que aceptar los términos y la política de privacidad.';
  }
  return { data, errors };
}
