import { STORE_TEMPLATES, slugError, slugify } from './platformStores.js';
import { TERMS_VERSION } from './storeRequest.js';

// Alta de tienda por autoservicio: reglas compartidas por el asistente y el servidor
// (api/store-signup.js).

export { TERMS_VERSION, slugify };

const clean = (value, max) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function validateStoreSignup(input = {}) {
  const data = {
    name: clean(input.name, 60),
    slug: clean(input.slug, 40).toLowerCase(),
    template: clean(input.template, 20)
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Poné el nombre de tu tienda.';
  const invalidSlug = slugError(data.slug);
  if (invalidSlug) errors.slug = invalidSlug;
  if (!STORE_TEMPLATES.some(t => t.id === data.template)) errors.template = 'Elegí el rubro.';
  if (!input.accepted_terms || input.terms_version !== TERMS_VERSION) {
    errors.accepted_terms = 'Tenés que aceptar los términos y la política de privacidad.';
  }
  return { data, errors };
}
