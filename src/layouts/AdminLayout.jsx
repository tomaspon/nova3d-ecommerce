import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Tag, Settings, LogOut, Box } from 'lucide-react';

export default function AdminLayout() {
  const location = useLocation();

  const menuItems = [
    { name: 'Resumen', path: '/admin', icon: LayoutDashboard },
    { name: 'Productos', path: '/admin/products', icon: Package },
    { name: 'Categorías', path: '/admin/categories', icon: Tag },
    { name: 'Órdenes', path: '/admin/orders', icon: Box },
    { name: 'Configuración', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
      {/* Sidebar Oscuro */}
      <aside className="w-64 border-r border-white/5 bg-black flex flex-col hidden md:flex shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">SE</div>
            <span className="font-bold text-white tracking-tight">StoreEngine</span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <div className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase mb-2 px-2">Menú Principal</div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
            Volver a la Tienda
          </Link>
        </div>
      </aside>

      {/* Contenido del Panel */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Topbar móvil / utilidades */}
        <header className="h-20 border-b border-white/5 bg-black/50 backdrop-blur flex items-center justify-between px-8">
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold text-white">
              A
            </div>
            <span className="text-sm font-medium">Administrador</span>
          </div>
        </header>

        {/* Zona de renderizado dinámica */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
