import { describe, it, expect } from 'vitest';
import { availablePaymentMethods, storeWhatsappLink } from './paymentMethods';
import { DEFAULT_STORE_ID } from './storeIds';

describe('availablePaymentMethods', () => {
  it('la tienda principal cobra con MercadoPago aunque no haya conectado su cuenta', () => {
    expect(availablePaymentMethods({ id: DEFAULT_STORE_ID }, { transfer_alias: 'x' })).toEqual(['MercadoPago', 'Transferencia']);
  });

  it('una tienda nueva solo ofrece lo que configuró', () => {
    expect(availablePaymentMethods({ id: 'b', mp_connected: false }, {})).toEqual([]);
    expect(availablePaymentMethods({ id: 'b', mp_connected: true }, {})).toEqual(['MercadoPago']);
    expect(availablePaymentMethods({ id: 'b' }, { transfer_cbu: '0000' })).toEqual(['Transferencia']);
  });
});

describe('storeWhatsappLink', () => {
  it('arma el link con el número de la tienda o no muestra nada', () => {
    expect(storeWhatsappLink({ contact_whatsapp: '+54 9 291 555-1234' }, 'Hola')).toBe('https://wa.me/5492915551234?text=Hola');
    expect(storeWhatsappLink({}, 'Hola')).toBeNull();
  });
});
