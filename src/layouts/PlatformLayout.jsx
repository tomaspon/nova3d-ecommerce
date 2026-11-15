import { Suspense } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { BarChart3, Store, Inbox, Users, Globe, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { onPlatformHost } from '../platformBrand';
import { PLATFORM_BRAND } from '../platformBrand';

// Panel del administrador de la plataforma: separado del panel de cada tienda.
const NAV = [
  { to: '/superadmin', label: 'Resumen', icon: BarChart3, end: true },
  { to: '/superadmin/tiendas', label: 'Tiendas', icon: Store },
  { to: '/superadmin/solicitudes', label: 'Solicitudes', icon: Inbox },
  { to: '/superadmin/usuarios', label: 'Usuarios', icon: Users }
];

export default function PlatformLayout() {
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${isActive ? 'bg-indigo-600/15 text-indigo-300 font-bold border border-indigo-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/5 font-medium'}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
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
            <NavLink key={to} to={to} end={end} className={linkClass}><Icon className="w-4 h-4" /> {label}</NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-0.5">
          <Link to={onPlatformHost() ? '/' : '/inicio'} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition">
            <Globe className="w-4 h-4" /> Página oficial
          </Link>
          <button type="button" onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/5 bg-black sticky top-0 z-30">
          <span className="font-black text-white">{PLATFORM_BRAND.name} · Admin</span>
          <button type="button" onClick={logout} aria-label="Cerrar sesión" className="p-2 text-zinc-500"><LogOut className="w-4 h-4" /></button>
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
