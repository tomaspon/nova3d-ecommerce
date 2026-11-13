import { STORE_TEMPLATES } from './platformStores.js';

// Solicitud de tienda desde la página oficial. La usan el formulario y el servidor
// (api/store-request.js), así las reglas son las mismas en los dos lados.

// Versión de los términos que acepta quien pide la tienda. Si se cambia el texto
// de /plataforma/terminos, subir la versión: queda guardada con cada solicitud.
export const TERMS_VERSION = '2026-11-v1';

export const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa',
  'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

// Mismos rubros que las tiendas: el de la solicitud pasa directo a la tienda que se crea
export const REQUEST_CATEGORIES = STORE_TEMPLATES;

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

// CUIT/CUIL: 11 dígitos con dígito verificador
export function isValidCuit(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod;
  return check !== 10 && check === Number(digits[10]);
}

// DNI (7 u 8 dígitos) o CUIT/CUIL válido
export function isValidTaxId(value) {
  const digits = onlyDigits(value);
  if (digits.length === 7 || digits.length === 8) return true;
  return isValidCuit(digits);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (value, max = 120) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// Devuelve { data, errors }. data trae los valores limpios listos para guardar.
export function validateStoreRequest(input = {}) {
  const data = {
    owner_name: clean(input.owner_name, 80),
    tax_id: onlyDigits(input.tax_id),
    email: clean(input.email, 120).toLowerCase(),
    phone: onlyDigits(input.phone),
    city: clean(input.city, 80),
    province: clean(input.province, 40),
    business_name: clean(input.business_name, 60),
    category: clean(input.category, 20),
    social_url: clean(input.social_url, 200) || null,
    has_domain: Boolean(input.has_domain),
    domain: input.has_domain ? clean(input.domain, 120).toLowerCase() || null : null,
    message: clean(input.message, 600) || null
  };

  const errors = {};
  if (data.owner_name.split(' ').length < 2) errors.owner_name = 'Escribí nombre y apellido.';
  if (!isValidTaxId(data.tax_id)) errors.tax_id = 'Ingresá un DNI (7 u 8 números) o un CUIT/CUIL válido.';
  if (!EMAIL.test(data.email)) errors.email = 'El email no es válido.';
  if (data.phone.length < 8 || data.phone.length > 15) errors.phone = 'Ingresá un teléfono con código de área.';
  if (!data.city) errors.city = 'Falta la ciudad.';
  if (!PROVINCES.includes(data.province)) errors.province = 'Elegí la provincia.';
  if (!data.business_name) errors.business_name = 'Falta el nombre de tu marca o negocio.';
  if (!REQUEST_CATEGORIES.some(c => c.id === data.category)) errors.category = 'Elegí el rubro.';
  if (input.terms_version !== TERMS_VERSION || !input.accepted_terms) {
    errors.accepted_terms = 'Tenés que aceptar los términos y la política de privacidad.';
  }

  return { data, errors };
}
