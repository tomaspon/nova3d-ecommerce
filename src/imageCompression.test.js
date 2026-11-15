import { describe, it, expect } from 'vitest';
import { fitWithin, compressImage } from './imageCompression';

describe('compresión de fotos', () => {
  it('achica al lado más largo, manteniendo la proporción', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('no agranda las fotos chicas', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('deja como están los SVG, GIF y lo que no es imagen', async () => {
    const svg = { type: 'image/svg+xml', name: 'logo.svg' };
    const pdf = { type: 'application/pdf', name: 'a.pdf' };
    expect(await compressImage(svg)).toBe(svg);
    expect(await compressImage(pdf)).toBe(pdf);
  });
});
