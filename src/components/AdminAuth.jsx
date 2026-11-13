import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { isAdminUser } from '../adminAccess';
import { useStore } from '../context/StoreContext';

export default function AdminAuth({ children }) {
  const { store } = useStore();
  // session: undefined = todavía verificando, null = sin sesión
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Entra el administrador de la plataforma (a cualquier tienda) o quien administra esta tienda.
  // El rol de plataforma viaja dentro del token: si se asignó en Supabase después de iniciar
  // sesión, el token guardado no lo tiene, así que se pide uno nuevo antes de rechazar la cuenta.
  const [access, setAccess] = useState(null); // { key, allowed }
  const accessKey = session && store ? `${session.user.id}:${store.id}` : null;

  useEffect(() => {
    if (!accessKey) return;
    let cancelled = false;
    (async () => {
      let allowed = isAdminUser(session.user);
      if (!allowed) {
        const { data } = await supabase.auth.refreshSession();
        allowed = isAdminUser(data?.session?.user);
      }
      if (!allowed) {
        const { data } = await supabase.rpc('is_store_admin', { p_store_id: store.id });
        allowed = data === true;
      }
      if (!cancelled) setAccess({ key: accessKey, allowed });
    })();
    return () => { cancelled = true; };
    // session y store cambian de objeto sin cambiar de usuario o tienda: alcanza con la clave
  }, [accessKey]);

  const isChecking = session === undefined || !store || (accessKey !== null && access?.key !== accessKey);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Mismo mensaje para email inexistente y clave incorrecta: no revela qué cuentas existen
      setError('Email o contraseña incorrectos.');
    }
    setPassword('');
    setIsSubmitting(false);
  };

  if (isChecking) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  if (session && access?.allowed) {
    return children;
  }

  const inputClass = "w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-indigo-500 transition";

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

        {session ? (
          // Sesión iniciada con una cuenta que no es administradora
          <div className="space-y-4 relative z-10">
            <p className="text-sm text-zinc-400 text-center break-words">
              La cuenta {session.user.email} no administra {store.name || 'esta tienda'}.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400 text-center mb-8">Ingresá con tu cuenta de administrador.</p>

            <form onSubmit={handleLogin} className="space-y-4 relative z-10">
              <input
                type="email"
                placeholder="Email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
                autoFocus
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar al Panel
              </button>
            </form>
          </>
        )}
      </div>

      <Link to="/" className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors">Volver a la tienda</Link>
    </div>
  );
}
