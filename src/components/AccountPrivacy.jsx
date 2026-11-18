import { useState } from 'react';
import { Download, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Mis datos › Privacidad: el comprador puede llevarse sus datos y borrar su cuenta (Ley 25.326).
// Los pedidos quedan en la tienda (los necesita para facturar y para garantías), sin la cuenta asociada.

export function accountExport(user, orders = [], store = null) {
  const shipping = user?.user_metadata?.shipping || {};
  return {
    exportado: new Date().toISOString(),
    tienda: store?.name || null,
    cuenta: { email: user?.email || null, creada: user?.created_at || null },
    datos: shipping,
    pedidos: orders.map(o => ({
      numero: String(o.id || '').split('-')[0].toUpperCase(),
      fecha: o.created_at,
      estado: o.status,
      total: o.total,
      pago: o.payment_method,
      articulos: (o.items || []).map(i => ({ nombre: i.name, cantidad: i.quantity, precio: i.price }))
    }))
  };
}

export default function AccountPrivacy({ user, orders, store }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = () => {
    const blob = new Blob([JSON.stringify(accountExport(user, orders, store), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `mis-datos-${(store?.slug || 'tienda')}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/store-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ action: 'deleteMyAccount', confirm: typed.trim().toLowerCase() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'No pudimos borrar tu cuenta.');
      await supabase.auth.signOut();
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const matches = typed.trim().toLowerCase() === String(user?.email || '').toLowerCase();

  return (
    <div className="mt-8 bg-white dark:bg-[#0c0c0c] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white mb-2">
        <ShieldCheck className="w-4 h-4 text-zinc-500" /> Tus datos y privacidad
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Podés llevarte una copia de tus datos o borrar tu cuenta cuando quieras.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={download} className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-btn border border-zinc-300 dark:border-white/15 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/5">
          <Download className="w-4 h-4" /> Descargar mis datos
        </button>
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-btn text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" /> Eliminar mi cuenta
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Se borran tu cuenta, tus datos guardados y tus favoritos. <b>No se puede deshacer.</b> Tus pedidos quedan en la tienda (los necesita para facturar y para cambios), pero ya no van a estar unidos a una cuenta.
          </p>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Para confirmar, escribí tu email (<span className="font-mono">{user?.email}</span>):
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-black px-4 py-3 text-base text-zinc-900 dark:text-white focus:outline-none focus:border-red-500" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={() => { setConfirming(false); setTyped(''); setError(''); }} className="min-h-11 px-5 rounded-btn text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5">Cancelar</button>
            <button type="button" onClick={remove} disabled={!matches || busy} className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-btn bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar para siempre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
