import { describe, it, expect } from 'vitest';
import { isValidCuit, isValidTaxId, validateStoreRequest, TERMS_VERSION } from './storeRequest';

const valid = {
  owner_name: '  Ana   Pérez ',
  tax_id: '20-12345678-6',
  email: 'Ana@Mail.com',
  phone: '(291) 555-1234',
  city: 'Bahía Blanca',
  province: 'Buenos Aires',
  business_name: 'Velas Luna',
  category: 'velas',
  accepted_terms: true,
  terms_version: TERMS_VERSION
};

describe('isValidCuit / isValidTaxId', () => {
  it('verifica el dígito del CUIT', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
    expect(isValidCuit('20-12345678-5')).toBe(false);
    expect(isValidCuit('123')).toBe(false);
  });

  it('acepta DNI de 7 u 8 números', () => {
    expect(isValidTaxId('30.111.222')).toBe(true);
    expect(isValidTaxId('1234567')).toBe(true);
    expect(isValidTaxId('12345')).toBe(false);
  });
});

describe('validateStoreRequest', () => {
  it('limpia los datos de una solicitud válida', () => {
    const { data, errors } = validateStoreRequest(valid);
    expect(errors).toEqual({});
    expect(data).toMatchObject({ owner_name: 'Ana Pérez', tax_id: '20123456786', email: 'ana@mail.com', phone: '2915551234', domain: null });
  });

  it('marca cada campo que falta o está mal', () => {
    const { errors } = validateStoreRequest({ ...valid, owner_name: 'Ana', tax_id: '1', email: 'x', phone: '12', province: 'Narnia', category: 'armas' });
    expect(Object.keys(errors).sort()).toEqual(['category', 'email', 'owner_name', 'phone', 'province', 'tax_id']);
  });

  it('sin aceptar los términos vigentes no se puede enviar', () => {
    expect(validateStoreRequest({ ...valid, accepted_terms: false }).errors.accepted_terms).toBeTruthy();
    expect(validateStoreRequest({ ...valid, terms_version: 'vieja' }).errors.accepted_terms).toBeTruthy();
  });
});
