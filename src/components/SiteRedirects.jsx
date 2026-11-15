import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { onPlatformHost, platformOrigin } from '../platformBrand';
import { panelPath, adminSectionFromOldPath, oldPlatformPath } from '../sitePaths';

// Redirecciones entre la plataforma y las tiendas, y desde las direcciones viejas.

const Blank = () => <div className="min-h-screen bg-zinc-950" />;

// Salta a otra dirección (otro dominio o recarga completa)
function GoTo({ href }) {
  useEffect(() => { window.location.replace(href); }, [href]);
  return <Blank />;
}

// En una tienda, una página de la plataforma: se abre en la dirección de la plataforma
export function ToPlatform() {
  const { pathname, search } = useLocation();
  return <GoTo href={`${platformOrigin()}${pathname}${search}`} />;
}

// tienda.com/admin(/settings...) → panel de esa tienda en la plataforma
export function AdminToPanel() {
  const { store } = useStore();
  const { pathname, search } = useLocation();
  if (!store) return <Blank />;
  if (!store.slug || store.isDemo) return <GoTo href="/" />;
  return <GoTo href={`${platformOrigin()}${panelPath(store.slug, adminSectionFromOldPath(pathname))}${search}`} />;
}

// /plataforma/... (direcciones viejas) → /, /crear, /superadmin/...
export function OldPlatformRedirect() {
  const { pathname, search } = useLocation();
  let to = oldPlatformPath(pathname) || '/';
  if (to === '/' && !onPlatformHost()) to = '/inicio';
  // Carga completa: el destino puede ser de otra área de sesión (superadmin / panel)
  return <GoTo href={`${to}${search}`} />;
}
