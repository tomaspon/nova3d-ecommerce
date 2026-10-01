import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';

export default function LoginPage() {
  const { session, signIn, signOut } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">SE</div>
          <span className="text-lg font-bold text-white tracking-tight">StoreEngine</span>
        </div>

        <div className="bg-black border border-white/10 rounded-2xl p-6 shadow-2xl">
          {session ? (
            // Sesión iniciada con un usuario que no está en la tabla de admins
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold text-white">Sin permisos</h1>
              <p className="text-sm text-zinc-400 break-words">
                La cuenta {session.user.email} no es administradora de esta tienda.
              </p>
              <button onClick={() => signOut()} className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition">
                Cerrar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Email</label>
                <input id="login-email" required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition" />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Contraseña</label>
                <input id="login-password" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                {isSubmitting ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-zinc-500 hover:text-white transition-colors">Volver a la Tienda</Link>
        </div>
      </div>
    </div>
  );
}
