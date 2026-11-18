import { Suspense, useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, Activity, Store, Inbox, Users, Globe, LogOut, ExternalLink, Sparkles, Bug } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PLATFORM_BRAND, onPlatformHost } from '../platformBrand';

// Panel del administrador de la plataforma: separado del panel de cada tienda.
const NAV = [
  { to: '/superadmin', label: 'Resumen', icon: BarChart3, end: true },
  { to: '/superadmin/trafico', label: 'Tráfico', icon: Activity },
  { to: '/superadmin/tiendas', label: 'Tiendas', icon: Store },
  { to: '/superadmin/solicitudes', label: 'Solicitudes', icon: Inbox },
  { to: '/superadmin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/superadmin/errores', label: 'Errores', icon: Bug }
];

// Página oficial (la que ven los emprendedores) y tienda de ejemplo: se abren en otra pestaña
const officialHref = () => (onPlatformHost() ? '/' : '/inicio');
const SHORTCUTS = [
  { href: officialHref, label: 'Página oficial', icon: Globe },
  { href: () => '/crear', label: 'Alta de tiendas', icon: Sparkles }
];

// Errores de las últimas 24 horas (Superadmin › Errores), para verlos sin entrar
function useErrorCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => supabase.rpc('recent_errors', { p_days: 1 }).then(({ data }) => {
      if (alive && Array.isArray(data)) setCount(data.reduce((sum, e) => sum + (e.times || 1), 0));
    }, () => {});
    load();
    const timer = setInterval(load, 5 * 60000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  return count;
}

export default function PlatformLayout() {
  const errorCount = useErrorCount();
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${isActive ? 'bg-indigo-600/15 text-indigo-300 font-bold border border-indigo-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/5 font-medium'}`;

  return (
    <div className="panel-a11y min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
      <aside className="w-60 shrink-0 border-r border-white/5 bg-black hidden md:flex flex-col">
        <div className="h-20 flex items-center gap-3 px-6 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm">
            {PLATFORM_BRAND.name.charAt(0)}
          </div>
          <div>
            <p className="font-black text-white text-sm leading-none">{PLATFORM_BRAND.name}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Administración</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon className="w-4 h-4" /> {label}
            {to.endsWith('/errores') && errorCount > 0 && <span className="ml-auto rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold px-1.5 py-0.5 tabular-nums" aria-label={`${errorCount} errores en las últimas 24 horas`}>{errorCount > 99 ? '99+' : errorCount}</span>}
          </NavLink>
          ))}
          <p className="px-3 pt-5 pb-1.5 text-[9px] font-black text-zinc-600 tracking-widest uppercase">Ver como cliente</p>
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <a key={label} href={href()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition">
              <Icon className="w-4 h-4" /> {label} <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60" />
            </a>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-0.5">
          <button type="button" onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/5 bg-black sticky top-0 z-30">
          <span className="font-black text-white">{PLATFORM_BRAND.name} · Admin</span>
          <div className="flex items-center">
            <a href={officialHref()} target="_blank" rel="noopener noreferrer" aria-label="Abrir la página oficial" title="Página oficial" className="p-2 text-zinc-400 hover:text-white"><Globe className="w-4 h-4" /></a>
            <button type="button" onClick={logout} aria-label="Cerrar sesión" className="p-2 -mr-2 text-zinc-500"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>
        <div className="p-4 pb-28 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </div>
        {/* Menú inferior en celular */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-black/90 backdrop-blur border-t border-white/5 flex justify-around py-1.5 z-40">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
              <Icon className="w-5 h-5" /> {label}
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}
