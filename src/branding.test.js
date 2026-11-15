import { describe, it, expect } from 'vitest';
import { normalizeBranding, inkFor, instagramUrl } from './branding';

describe('normalizeBranding', () => {
  it('completa lo que falta con valores por defecto', () => {
    expect(normalizeBranding({})).toMatchObject({ primary_color: '', font: 'jakarta', theme: 'light', announcement_active: false });
    expect(normalizeBranding(null).font).toBe('jakarta');
  });

  it('descarta colores, tipografías y modos inválidos, y limpia las redes', () => {
    const b = normalizeBranding({ primary_color: 'rojo', font: 'comic', theme: 'neon', instagram: '@velas.luna' });
    expect(b).toMatchObject({ primary_color: '', font: 'jakarta', theme: 'light', instagram: 'velas.luna' });
    expect(normalizeBranding({ primary_color: '#E2553F' }).primary_color).toBe('#e2553f');
  });

  it('recorta textos demasiado largos', () => {
    expect(normalizeBranding({ announcement_text: 'x'.repeat(500) }).announcement_text).toHaveLength(120);
  });
});

describe('inkFor', () => {
  it('elige la tinta que más contrasta con el color de marca', () => {
    expect(inkFor('#4f46e5')).toBe('#ffffff'); // índigo → blanco
    expect(inkFor('#fde047')).toBe('#0b0b0b'); // amarillo claro → negro
    expect(inkFor('#0b0b0b')).toBe('#ffffff');
  });
});

describe('redes', () => {
  it('arma los links a partir del usuario', () => {
    expect(instagramUrl('velas.luna')).toBe('https://instagram.com/velas.luna');
    expect(instagramUrl('')).toBeNull();
  });
});
