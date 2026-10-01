import React, { useState, useRef } from 'react';
import { Outlet, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, User, ShoppingBag, X, Moon, Sun } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import CartDrawer from '../components/CartDrawer';

export default function StoreLayout() {
  const { cart, toggleCart, user, isDarkMode, toggleDarkMode } = useStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get('q') || '';
  
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = e.target.search.value;
    if (q.trim()) {
      navigate(`/?q=${encodeURIComponent(q)}`);
    } else {
      navigate(`/`);
    }
  };

  const toggleSearch = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col relative transition-colors duration-300">
      <CartDrawer />

      <header className="h-16 md:h-24 bg-[#FAFAFA]/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 flex items-center justify-between px-4 md:px-8 lg:px-12 sticky top-0 z-40 transition-colors duration-300">
        
        {/* LOGO */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 md:w-9 md:h-9 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-serif font-bold italic group-hover:scale-110 transition-transform duration-500 ease-out shadow-md">M</div>
            <span className="text-lg md:text-[1.35rem] font-black tracking-tighter text-black dark:text-white">MINIMAL.</span>
          </Link>
        </div>
        
        {/* LINKS */}
        <nav className="hidden md:flex items-center gap-10 text-[14px] font-bold absolute left-1/2 -translate-x-1/2">
          <Link 
            to="/" 
            className={`transition-all duration-300 relative py-2 ${isActive('/') ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
          >
            Catálogo
            {isActive('/') && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black dark:bg-white rounded-t-full animate-in fade-in zoom-in duration-300"></span>}
          </Link>
          <Link 
            to="/nosotros" 
            className={`transition-all duration-300 relative py-2 ${isActive('/nosotros') ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
          >
            Nosotros
            {isActive('/nosotros') && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black dark:bg-white rounded-t-full animate-in fade-in zoom-in duration-300"></span>}
          </Link>
          <Link 
            to="/seguimiento" 
            className={`transition-all duration-300 relative py-2 ${isActive('/seguimiento') ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
          >
            Seguimiento
            {isActive('/seguimiento') && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black dark:bg-white rounded-t-full animate-in fade-in zoom-in duration-300"></span>}
          </Link>
        </nav>

        {/* ICONS & SEARCH BAR */}
        <div className="flex items-center gap-6 text-zinc-700 dark:text-zinc-400 shrink-0">
          
          {/* THEME TOGGLE */}
          <button onClick={toggleDarkMode} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-black dark:hover:text-white transition-colors" title="Alternar tema">
            {isDarkMode ? <Sun className="w-5 h-5" strokeWidth={2} /> : <Moon className="w-5 h-5" strokeWidth={2} />}
          </button>

                    {/* SEARCH BUTTON */}
          <button onClick={() => setIsSearchOpen(true)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-black dark:hover:text-white transition-colors" aria-label="Abrir buscador">
            <Search className="w-5 h-5" strokeWidth={2} />
          </button>

          <Link to={user ? "/perfil" : "/login"} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-black dark:hover:text-white transition-colors">
            <User className="w-5 h-5" strokeWidth={2} />
          </Link>
          
          <div className="relative cursor-pointer group p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={toggleCart}>
            <ShoppingBag className="w-5 h-5 group-hover:text-black dark:group-hover:text-white transition-colors" strokeWidth={2} />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </div>
        </div>

      </header>

      <main className="flex-1 flex flex-col pb-0">
        <Outlet />
      </main>
      
      {/* Footer Minimalista */}
      <footer className="border-t border-zinc-200 dark:border-white/5 py-12 px-4 md:px-8 lg:px-12 mt-auto flex flex-col md:flex-row items-center justify-between text-sm font-bold text-zinc-400 dark:text-zinc-600">
        <div>© 2026 Nova3D. Todos los derechos reservados.</div>
        <div className="flex gap-6 mt-4 md:mt-0">
          <Link to="#" className="hover:text-black dark:hover:text-white transition">Instagram</Link>
          <Link to="#" className="hover:text-black dark:hover:text-white transition">Términos</Link>
        </div>
      </footer>
    
      {/* SEARCH OVERLAY */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start pt-24 px-4 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md animate-in fade-in duration-200" onKeyDown={(e) => e.key === 'Escape' && setIsSearchOpen(false)}>
          <button 
            onClick={() => setIsSearchOpen(false)} 
            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          
          <form 
            onSubmit={(e) => {
              handleSearchSubmit(e);
              setIsSearchOpen(false);
            }} 
            className="w-full max-w-2xl animate-in slide-in-from-top-4 duration-300"
          >
            <div className="flex items-center gap-4 md:gap-6 border-b-2 border-zinc-200 dark:border-white/10 pb-4">
              <Search className="w-8 h-8 md:w-10 md:h-10 text-zinc-400 shrink-0" />
              <input 
                name="search"
                defaultValue={currentQuery}
                placeholder="¿Qué estás buscando?" 
                className="w-full bg-transparent text-2xl md:text-5xl font-black text-black dark:text-white focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                autoComplete="off"
                autoFocus
              />
            </div>
          </form>
          <p className="mt-6 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center px-4">↵ Presioná Enter para buscar · ESC para cerrar</p>
        </div>
      )}
    </div>
  );
}

