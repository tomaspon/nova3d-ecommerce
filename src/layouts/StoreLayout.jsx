import { Outlet, Link } from 'react-router-dom';
import { Search, User, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import CartDrawer from '../components/CartDrawer';

export default function StoreLayout() {
  const { cart, toggleCart } = useStore();
  
  // Calcular cantidad total de items
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col relative">
      
      {/* Componente del Carrito Lateral */}
      <CartDrawer />

      {/* Navbar Realista "MINIMAL." */}
      <header className="h-24 bg-white border-b border-zinc-100 flex items-center justify-between px-8 lg:px-12 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold italic group-hover:scale-105 transition-transform">M</div>
            <span className="text-[1.35rem] font-black tracking-tighter">MINIMAL.</span>
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-[15px] font-bold text-zinc-400">
          <Link to="/" className="text-zinc-900 border-b-2 border-zinc-900 pb-1">Catálogo</Link>
          <Link to="/" className="hover:text-zinc-900 transition-colors">Colecciones</Link>
          <Link to="/" className="hover:text-zinc-900 transition-colors">Nosotros</Link>
        </nav>

        <div className="flex items-center gap-7 text-zinc-700">
          <Search className="w-5 h-5 cursor-pointer hover:text-black transition-colors" strokeWidth={2} />
          <User className="w-5 h-5 cursor-pointer hover:text-black transition-colors" strokeWidth={2} />
          <div className="relative cursor-pointer group" onClick={toggleCart}>
            <ShoppingBag className="w-5 h-5 group-hover:text-black transition-colors" strokeWidth={2} />
            {cartItemsCount > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#5c4ce5] rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                {cartItemsCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-16 mt-auto">
        <div className="max-w-4xl mx-auto px-6 text-center text-zinc-400 text-sm">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold italic mx-auto mb-4">M</div>
          <p>© 2026 MINIMAL. Desarrollado con StoreEngine.</p>
          <div className="mt-4">
            <Link to="/admin" className="text-indigo-500 hover:underline font-medium">Panel de Administración</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
