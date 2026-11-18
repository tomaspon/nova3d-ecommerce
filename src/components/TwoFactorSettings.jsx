import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { MfaEnroll } from './AdminAuth';

// Panel › Configuración › Seguridad: verificación en dos pasos opcional para el dueño.
// Con la app vinculada, al entrar al panel (AdminAuth) se pide además el código del celular.
export default function TwoFactorSettings() {
  const [factor, setFactor] = useState(undefined); // undefined = cargando, null = sin activar
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactor(data?.totp?.[0] || null);
  };
  useEffect(() => { load(); }, []);

  const disable = async () => {
    if (!window.confirm('¿Desactivar la verificación en dos pasos? Tu cuenta va a quedar protegida solo con la contraseña.')) return;
    setBusy(true);
    setError('');
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) setError('No se pudo desactivar. Cerrá sesión, entrá de nuevo con el código y probá otra vez.');
    else await load();
    setBusy(false);
  };

  return (
    <div className="bg-black border border-white/10 rounded-2xl p-6 sm:p-8">
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Verificación en dos pasos</h2>
      <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4">
        Además de la contraseña, al entrar al panel te pedimos un código de la app de tu celular. Si alguien consigue tu contraseña, igual no puede entrar ni tocar tus ventas.
      </p>

      {factor === undefined ? (
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      ) : factor ? (
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-sm font-bold text-emerald-300">
            <ShieldCheck className="w-4 h-4" /> Activada
          </p>
          <div>
            <button type="button" onClick={disable} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-zinc-300 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />} Desactivar
            </button>
          </div>
        </div>
      ) : enrolling ? (
        <div className="max-w-sm">
          <MfaEnroll friendlyName="Panel" onVerified={() => { setEnrolling(false); load(); }} />
          <button type="button" onClick={() => setEnrolling(false)} className="mt-4 w-full text-xs text-zinc-500 hover:text-white">Cancelar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setEnrolling(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white">
          <ShieldCheck className="w-4 h-4" /> Activar (recomendado)
        </button>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
