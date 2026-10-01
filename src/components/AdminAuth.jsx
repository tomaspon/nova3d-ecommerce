import React, { useState, useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';

export default function AdminAuth({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Reemplazar esto idealmente por una variable de entorno en Vercel (VITE_ADMIN_PASSWORD)
  const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  useEffect(() => {
    const token = localStorage.getItem('nova3d_admin_token');
    if (token === 'authenticated') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASS) {
      localStorage.setItem('nova3d_admin_token', 'authenticated');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  if (isAuthenticated) {
    return children;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {/* Decoración Background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white text-center mb-2 tracking-tight">Acceso Restringido</h1>
        <p className="text-sm text-zinc-400 text-center mb-8">Ingresá la contraseña maestra para administrar Nova3D.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input 
              type="password" 
              placeholder="Contraseña Maestra"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-center text-white focus:outline-none focus:border-indigo-500 transition font-mono tracking-widest"
              autoFocus
            />
          </div>
          
          {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest text-xs"
          >
            Entrar al Panel
          </button>
        </form>
      </div>
    </div>
  );
}
