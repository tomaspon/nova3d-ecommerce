import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Loader2, LogIn, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase, rememberAuthReturn } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { isShowcaseStore, storeHref } from '../../currentStore';
import SocialButtons from '../../components/SocialButtons';
import { track } from '../../analytics';
import { MIN_PASSWORD_LENGTH, validateSignup, cleanPhone } from '../../profileCompletion';

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

const inputClass = 'w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Solo al crear la cuenta: la contraseña otra vez, nombre y celular
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, toggleCart, store } = useStore();

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
    if (isRegistering) {
      const found = validateSignup({ name, phone, email, password, passwordConfirm });
      setFieldErrors(found);
      if (Object.keys(found).length) return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isResetting) {
        rememberAuthReturn(storeHref(store, '/perfil?tab=datos'));
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: storeHref(store, '/perfil?tab=datos'),
        });
        if (error) throw error;
        setSuccessMsg("Te enviamos un correo con las instrucciones para restablecer tu contraseña.");
        setIsResetting(false);
      } else if (isRegistering) {
        // Al confirmar el mail: a "Mis datos", con la bienvenida, para sumar DNI y dirección
        const welcomeUrl = storeHref(store, '/perfil?tab=datos&bienvenida=1');
        rememberAuthReturn(welcomeUrl);
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: welcomeUrl,
            // Mismo lugar donde los usan el perfil y el checkout
            data: { shipping: { name: name.trim(), phone: cleanPhone(phone) } }
          }
        });
        if (error) throw error;
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          // Supabase no devuelve error si el email ya existe; lo indica con identities vacío
          setErrorMsg('Ya existe una cuenta con ese email. Iniciá sesión o restablecé tu clave.');
        } else {
          track(store, 'signup', { label: 'email' });
        }
        if (data.user && data.user.identities?.length !== 0 && !data.session) {
          setSuccessMsg("¡Cuenta creada! Revisá tu mail y tocá el enlace para confirmarla.");
        }
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track(store, 'login', { label: 'email' });
      }
    } catch (error) {
      setErrorMsg(translateAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // En la tienda de ejemplo no se inicia sesión: es solo una muestra
  if (isShowcaseStore(store)) {
    return (
      <div className="min-h-[calc(100vh-6rem)] bg-store dark:bg-store-dark flex flex-col items-center justify-center text-center p-8">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Tienda de ejemplo</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">Acá no se crean cuentas ni se guardan datos. Es una muestra de cómo se ve una tienda.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-6 rounded-btn bg-brand text-brand-ink font-bold px-6 py-3 hover:opacity-90 transition">Volver al catálogo</button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-store dark:bg-store-dark flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">

        <div className="p-8 text-center border-b border-zinc-100 dark:border-white/10 bg-[#f4f4f5] dark:bg-zinc-950">
          <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center text-brand-ink font-serif font-bold italic mx-auto mb-4 shadow-sm">{(store?.name || '').charAt(0).toUpperCase()}</div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            {isResetting ? 'Restablecer Clave' : isRegistering ? 'Creá tu cuenta' : 'Bienvenido de vuelta'}
          </h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">
            {isResetting ? 'Ingresá tu mail y te enviaremos un link' : isRegistering ? 'Comprá más rápido y guardá favoritos' : 'Ingresá a tu cuenta para continuar'}
          </p>
        </div>

        <div className="p-8 space-y-6">

          {!isResetting && (
            <SocialButtons redirectTo={storeHref(store, `/perfil${searchParams.get('redirect') ? `?redirect=${searchParams.get('redirect')}` : ''}`)} />
          )}
          <form onSubmit={handleSubmit} noValidate={isRegistering} className="space-y-4">

            {isRegistering && (
              <>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Nombre y apellido</label>
                  <input value={name} onChange={e => { setName(e.target.value); setFieldErrors(x => ({ ...x, name: undefined })); }} autoComplete="name" className={inputClass} />
                  {fieldErrors.name && <p className="text-xs font-semibold text-red-500 mt-1.5">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Celular</label>
                  <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setFieldErrors(x => ({ ...x, phone: undefined })); }} autoComplete="tel" placeholder="291 555 1234" className={inputClass} />
                  {fieldErrors.phone && <p className="text-xs font-semibold text-red-500 mt-1.5">{fieldErrors.phone}</p>}
                </div>
              </>
            )}

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
                {isRegistering && (fieldErrors.password
                  ? <p className="text-xs font-semibold text-red-500 mt-1.5">{fieldErrors.password}</p>
                  : <p className="text-xs text-zinc-400 mt-2">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>)}
                {isRegistering && (
                  <div className="mt-4">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Repetí la contraseña</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={e => { setPasswordConfirm(e.target.value); setFieldErrors(x => ({ ...x, passwordConfirm: undefined })); }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={inputClass}
                    />
                    {fieldErrors.passwordConfirm && <p className="text-xs font-semibold text-red-500 mt-1.5">{fieldErrors.passwordConfirm}</p>}
                  </div>
                )}
              </div>
            )}

            <button
              disabled={isLoading}
              className="w-full bg-brand hover:opacity-90 text-brand-ink font-bold py-4 rounded-btn transition-all duration-300 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-black/5 disabled:opacity-70"
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
              <button onClick={() => { setIsRegistering(!isRegistering); setFieldErrors({}); setErrorMsg(null); }} className="text-black dark:text-white font-bold border-b border-black dark:border-white pb-0.5 ml-2 hover:text-[#5c4ce5] hover:border-[#5c4ce5] transition-colors">
                {isRegistering ? 'Iniciá sesión' : 'Crear cuenta'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
