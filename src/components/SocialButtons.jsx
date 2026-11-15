import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Botones "Continuar con Google / Apple / Facebook / Microsoft". Cada uno aparece solo cuando
// ese proveedor está activado en Supabase (Authentication → Sign In / Providers): se consulta
// la configuración pública de Supabase, así no hay que tocar el código para sumar uno.

const PROVIDERS = [
  {
    id: 'google', label: 'Google',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    )
  },
  {
    id: 'apple', label: 'Apple',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.52zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
      </svg>
    )
  },
  {
    id: 'facebook', label: 'Facebook',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
      </svg>
    )
  },
  {
    id: 'azure', label: 'Microsoft',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10.5v10.5H1z" /><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
        <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" /><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
      </svg>
    )
  }
];

let enabledCache = null;
async function enabledProviders() {
  if (!enabledCache) {
    enabledCache = fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }
    })
      .then(r => (r.ok ? r.json() : {}))
      .then(s => PROVIDERS.filter(p => s?.external?.[p.id] === true).map(p => p.id))
      .catch(() => []);
  }
  return enabledCache;
}

// variant: "light" (tiendas, alta) o "dark" (paneles). redirectTo: a dónde vuelve después de entrar.
export default function SocialButtons({ redirectTo, variant = 'light', dividerLabel = 'o con tu email' }) {
  const [enabled, setEnabled] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    enabledProviders().then(ids => { if (!cancelled) setEnabled(ids); });
    return () => { cancelled = true; };
  }, []);

  if (!enabled.length) return null;

  const signIn = async (provider) => {
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo || window.location.href } });
    if (oauthError) setError('No pudimos conectar con ese servicio. Probá de nuevo o usá tu email.');
  };

  const button = variant === 'dark'
    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700';
  const line = variant === 'dark' ? 'border-white/10' : 'border-zinc-200 dark:border-white/10';
  const label = variant === 'dark' ? 'bg-[#0a0a0a] text-zinc-500' : 'bg-white dark:bg-zinc-900 text-zinc-400';

  return (
    <div className="space-y-4">
      <div className={`grid gap-2 ${enabled.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {PROVIDERS.filter(p => enabled.includes(p.id)).map(p => (
          <button key={p.id} type="button" onClick={() => signIn(p.id)}
            className={`w-full border font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2.5 text-sm ${button}`}>
            {p.icon} Continuar con {p.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs font-bold text-red-500 text-center">{error}</p>}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className={`w-full border-t ${line}`} /></div>
        <div className="relative flex justify-center"><span className={`px-2 font-bold text-[11px] uppercase tracking-widest ${label}`}>{dividerLabel}</span></div>
      </div>
    </div>
  );
}
