import { describe, it, expect } from 'vitest';
import { authAreaFor } from './supabaseClient';

describe('tres inicios de sesión separados', () => {
  it('compradores en las tiendas', () => {
    for (const p of ['/', '/producto/1', '/perfil', '/login', '/seguimiento']) expect(authAreaFor(p)).toBe('store');
  });

  it('dueños de tiendas en el panel y el alta', () => {
    for (const p of ['/panel', '/panel/lucyy/productos', '/crear', '/ingresar', '/admin', '/inicio']) expect(authAreaFor(p)).toBe('panel');
    // En la dirección propia de la plataforma, la página oficial también
    expect(authAreaFor('/', true)).toBe('panel');
  });

  it('el superadmin, aparte de todo lo demás', () => {
    for (const p of ['/superadmin', '/superadmin/usuarios', '/plataforma', '/plataforma/tiendas']) expect(authAreaFor(p)).toBe('superadmin');
    expect(authAreaFor('/superadmin', true)).toBe('superadmin');
  });
});
