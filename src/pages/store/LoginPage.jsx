import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Loader2, LogIn, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';

// El botón de Google se muestra recién cuando el proveedor está configurado en Supabase (VITE_GOOGLE_LOGIN=true en Vercel)
const GOOGLE_LOGIN_ENABLED = import.meta.env.VITE_GOOGLE_LOGIN === 'true';

const MIN_PASSWORD_LENGTH = 8;

// Supabase devuelve los errores en inglés
const translateAuthError = (error) => {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu casilla y tocá el enlace que te enviamos.';
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese email. Iniciá sesión o restablecé tu clave.';
  if (msg.includes('password should be') || msg.includes('weak')) return `La contraseña es muy débil. Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (msg.includes('rate limit') || msg.includes('security purposes')) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
  return 'No pudimos completar la operación. Intentá de nuevo.';
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, toggleCart } = useStore();

  // Al iniciar sesión se vuelve a donde estaba el cliente: el carrito si venía de comprar, si no el perfil
  useEffect(() => {
    if (user) {
      if (searchParams.get('redirect') === 'carrito') {
        navigate('/');
        toggleCart();
      } else {
        navigate('/perfil');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      if (isResetting) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/perfil?tab=datos',
        });
        if (error) throw error;
        setSuccessMsg("Te enviamos un correo con las instrucciones para restablecer tu contraseña.");
        setIsResetting(false);
      } else if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          // Supabase no devuelve error si el email ya existe; lo indica con identities vacío
          setErrorMsg('Ya existe una cuenta con ese email. Iniciá sesión o restablecé tu clave.');
        } else if (!data.session) {
          setSuccessMsg("¡Cuenta creada! Revisá tu mail y tocá el enlace para confirmarla.");
        }
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setErrorMsg(translateAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      alert("La configuración de Google Cloud en Supabase no está terminada aún. Para el MVP usá Correo/Contraseña.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-zinc-50 dark:bg-[#121212] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="p-8 text-center border-b border-zinc-100 dark:border-white/10 bg-[#f4f4f5] dark:bg-zinc-950">
          <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-serif font-bold italic mx-auto mb-4 shadow-sm">M</div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            {isResetting ? 'Restablecer Clave' : isRegistering ? 'Creá tu cuenta' : 'Bienvenido de vuelta'}
          </h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">
            {isResetting ? 'Ingresá tu mail y te enviaremos un link' : isRegistering ? 'Comprá más rápido y guardá favoritos' : 'Ingresá a tu cuenta para continuar'}
          </p>
        </div>

        <div className="p-8 space-y-6">
          
          {!isResetting && GOOGLE_LOGIN_ENABLED && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuar con Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-white/10"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-zinc-900 text-zinc-400 font-bold text-xs uppercase tracking-widest">O con correo</span></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold p-3 rounded-lg border border-red-100 dark:border-red-500/20">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-50 dark:bg-emerald-500/10 text-green-600 dark:text-emerald-400 text-sm font-bold p-3 rounded-lg border border-green-100 dark:border-emerald-500/20">
                {successMsg}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Correo Electrónico</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                autoComplete="email"
                className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition"
                required
              />
            </div>
            
            {!isResetting && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Contraseña</label>
                  {!isRegistering && (
                    <button type="button" onClick={() => setIsResetting(true)} className="text-xs font-bold text-[#5c4ce5] hover:text-[#4b3ed1]">
                      ¿Olvidaste tu clave?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    minLength={isRegistering ? MIN_PASSWORD_LENGTH : undefined}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {isRegistering && (
                  <p className="text-xs text-zinc-400 mt-2">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
                )}
              </div>
            )}

            <button 
              disabled={isLoading}
              className="w-full bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-black/5 disabled:opacity-70"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
              ) : isResetting ? (
                <><Mail className="w-4 h-4" /> Enviar Link</>
              ) : isRegistering ? (
                <><Mail className="w-4 h-4" /> Registrarme</>
              ) : (
                <><LogIn className="w-4 h-4" /> Iniciar Sesión</>
              )}
            </button>
            
            {isResetting && (
              <button 
                type="button"
                onClick={() => setIsResetting(false)}
                className="w-full text-zinc-500 font-bold py-2 hover:text-black dark:hover:text-white transition-colors text-sm"
              >
                Volver a Iniciar Sesión
              </button>
            )}
          </form>
        </div>

        {!isResetting && (
          <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-white/10 text-center">
            <p className="text-sm text-zinc-500 font-medium">
              {isRegistering ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}
              <button onClick={() => setIsRegistering(!isRegistering)} className="text-black dark:text-white font-bold border-b border-black dark:border-white pb-0.5 ml-2 hover:text-[#5c4ce5] hover:border-[#5c4ce5] transition-colors">
                {isRegistering ? 'Iniciá sesión' : 'Crear cuenta'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
