import { describe, it, expect } from 'vitest';
import { panelPath, panelSlugFromPath, panelSectionFromPath, isPlatformPath, adminSectionFromOldPath, oldPlatformPath } from './sitePaths';

describe('direcciones del panel', () => {
  it('la tienda va en la dirección', () => {
    expect(panelPath('velas-luna', 'productos')).toBe('/panel/velas-luna/productos');
    expect(panelPath('velas-luna')).toBe('/panel/velas-luna');
    expect(panelSlugFromPath('/panel/velas-luna/productos')).toBe('velas-luna');
    expect(panelSectionFromPath('/panel/velas-luna/productos')).toBe('productos');
    expect(panelSlugFromPath('/panel')).toBeNull();
    expect(panelSlugFromPath('/producto/1')).toBeNull();
  });

  it('distingue las páginas de la plataforma de las de la tienda', () => {
    for (const p of ['/inicio', '/crear', '/panel', '/panel/x/ordenes', '/superadmin/tiendas', '/admin']) expect(isPlatformPath(p)).toBe(true);
    for (const p of ['/', '/producto/1', '/seguimiento', '/paneles', '/administrar']) expect(isPlatformPath(p)).toBe(false);
  });

  it('las direcciones viejas llevan a las nuevas', () => {
    expect(adminSectionFromOldPath('/admin/settings')).toBe('configuracion');
    expect(adminSectionFromOldPath('/admin/orders')).toBe('ordenes');
    expect(adminSectionFromOldPath('/admin')).toBe('');
    expect(oldPlatformPath('/plataforma/inicio')).toBe('/');
    expect(oldPlatformPath('/plataforma/crear')).toBe('/crear');
    expect(oldPlatformPath('/plataforma')).toBe('/superadmin');
    expect(oldPlatformPath('/plataforma/tiendas')).toBe('/superadmin/tiendas');
    expect(oldPlatformPath('/plataformas')).toBeNull();
  });
});
