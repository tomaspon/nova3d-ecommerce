import { Suspense } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Tag, Settings, LogOut, Box, Truck, Store } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { LEGACY_ADMIN_TOKEN_KEY } from '../adminAccess';

export default function AdminLayout() {
  const location = useLocation();

  const handleLogout = async () => {
    localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const menuItems = [
    { name: 'Resumen', path: '/admin', icon: LayoutDashboard },
    { name: 'Productos', path: '/admin/products', icon: Package },
    { name: 'Categorías', path: '/admin/categories', icon: Tag },
    { name: 'Órdenes', path: '/admin/orders', icon: Box },
    { name: 'Envíos', path: '/admin/shipping', icon: Truck },
    { name: 'Config.', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
      {/* Sidebar Oscuro */}
      <aside className="w-60 border-r border-white/5 bg-black flex flex-col hidden md:flex shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">M</div>
            <div>
              <span className="font-black text-white tracking-tight text-sm leading-none block">MINIMAL.</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Admin Panel</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          <div className="text-[9px] font-black text-zinc-600 tracking-widest uppercase mb-2 px-3 mt-2">Panel Principal</div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${isActive ? 'bg-indigo-600/15 text-indigo-400 font-bold border border-indigo-500/20' : 'hover:bg-white/5 text-zinc-500 hover:text-white font-medium'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : ''}`} />
                {item.name}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-all text-sm font-medium">
            <Store className="w-4 h-4" />
            Ver la Tienda
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all text-sm font-medium">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido del Panel */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/5 bg-black/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center text-white font-black text-xs">M</div>
            <span className="font-black text-white text-sm">MINIMAL. Admin</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">En línea</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link to="/" className="text-xs font-bold text-zinc-500 hover:text-white transition-colors hidden sm:block">← Ver tienda</Link>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/20 to-indigo-700/20 border border-indigo-500/30 rounded-full flex items-center justify-center text-xs font-black text-indigo-400">
              A
            </div>
            <button onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="md:hidden p-2.5 -mr-2.5 text-zinc-500 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Zona de renderizado dinámica */}
        <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Cada sección del panel se descarga al abrirla */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Bottom Nav (Móvil) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
        <nav className="flex items-center overflow-x-auto hide-scrollbar snap-x px-1 py-1.5 gap-0.5 w-full">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`shrink-0 snap-center min-w-[64px] flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
