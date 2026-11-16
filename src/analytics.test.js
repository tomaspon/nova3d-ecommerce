import { describe, it, expect } from 'vitest';
import { deviceFor, externalReferrer } from './analytics';

describe('registro de tráfico', () => {
  it('aparato según el ancho de la pantalla', () => {
    expect(deviceFor(390)).toBe('mobile');
    expect(deviceFor(800)).toBe('tablet');
    expect(deviceFor(1440)).toBe('desktop');
  });

  it('origen: solo el dominio, y solo si viene de otro sitio', () => {
    expect(externalReferrer('https://l.instagram.com/?u=https%3A%2F%2Ftienda', 'velas.com')).toBe('l.instagram.com');
    expect(externalReferrer('https://velas.com/producto/1', 'velas.com')).toBeNull();
    expect(externalReferrer('', 'velas.com')).toBeNull();
  });
});
