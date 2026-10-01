import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Search, User, ShoppingBag, Menu, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import CartDrawer from '../components/CartDrawer';

export default function StoreLayout() {
  const { cart, toggleCart } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Calcular cantidad total de items
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  const navLinks = [
    { name: 'Catálogo', path: '/', isActive: true },
    { name: 'Colecciones', path: '/', isActive: false },
    { name: 'Nosotros', path: '/', isActive: false },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col relative">

      {/* Componente del Carrito Lateral */}
      <CartDrawer />

      {/* Navbar Realista "MINIMAL." */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="h-16 md:h-24 flex items-center justify-between px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-1">
            {/* Botón de menú (solo móvil) */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isMenuOpen}
              className="md:hidden p-2.5 -ml-2.5 text-zinc-700 hover:text-black transition-colors"
            >
              {isMenuOpen ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
            </button>
            <Link to="/" className="flex items-center gap-2.5 md:gap-3 group" onClick={() => setIsMenuOpen(false)}>
              <div className="w-8 h-8 md:w-9 md:h-9 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold italic group-hover:scale-105 transition-transform">M</div>
              <span className="text-lg md:text-[1.35rem] font-black tracking-tighter">MINIMAL.</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[15px] font-bold text-zinc-400">
            {navLinks.map(link => (
              <Link
                key={link.name}
                to={link.path}
                className={link.isActive ? 'text-zinc-900 border-b-2 border-zinc-900 pb-1' : 'hover:text-zinc-900 transition-colors'}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 md:gap-3 -mr-2.5 text-zinc-700">
            <button type="button" aria-label="Buscar" className="p-2.5 hover:text-black transition-colors">
              <Search className="w-5 h-5" strokeWidth={2} />
            </button>
            <button type="button" aria-label="Mi cuenta" className="p-2.5 hover:text-black transition-colors">
              <User className="w-5 h-5" strokeWidth={2} />
            </button>
            <button type="button" aria-label="Abrir carrito" onClick={toggleCart} className="relative p-2.5 hover:text-black transition-colors">
              <ShoppingBag className="w-5 h-5" strokeWidth={2} />
              {cartItemsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 bg-[#5c4ce5] rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Menú desplegable (solo móvil) */}
        {isMenuOpen && (
          <nav className="md:hidden border-t border-zinc-100 px-4 py-2 flex flex-col text-[15px] font-bold text-zinc-400">
            {navLinks.map(link => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`py-3 ${link.isActive ? 'text-zinc-900' : 'hover:text-zinc-900 transition-colors'}`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-10 md:py-16 mt-auto">
        <div className="max-w-4xl mx-auto px-6 text-center text-zinc-400 text-sm">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold italic mx-auto mb-4">M</div>
          <p>© 2026 MINIMAL. Desarrollado con StoreEngine.</p>
          <div className="mt-4">
            <Link to="/admin" className="inline-block py-2 text-indigo-500 hover:underline font-medium">Panel de Administración</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
