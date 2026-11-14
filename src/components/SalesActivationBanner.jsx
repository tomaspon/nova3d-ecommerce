import { useState } from 'react';
import { Rocket, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useStore } from '../context/StoreContext';

// Aviso del panel para tiendas nuevas: todavía no reciben pedidos hasta que la plataforma
// verifica al titular y habilita las ventas. Desde acá el dueño pide la activación.
export default function SalesActivationBanner() {
  const { store } = useStore();
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  if (!store || store.sales_enabled !== false) return null;

  const requestActivation = async () => {
    setStatus('sending');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/store-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ action: 'requestActivation', storeId: store.id })
      });
      const body = await response.json().catch(() => ({}));
      setMessage(body.message || (response.ok ? '' : 'No se pudo enviar el pedido.'));
      setStatus(response.ok ? 'sent' : 'error');
    } catch {
      setMessage('No hay conexión. Probá de nuevo.');
      setStatus('error');
    }
  };

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 sm:p-5">
      <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
        <Rocket className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white">Tu tienda todavía no recibe pedidos</p>
        <p className="text-sm text-zinc-400 mt-0.5">
          {status === 'sent' || status === 'error'
            ? message
            : 'Cargá tus productos y, cuando esté lista, pedí la activación: verificamos tus datos y habilitamos las ventas.'}
        </p>
      </div>
      {status === 'sent' ? (
        <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Pedido enviado</span>
      ) : (
        <button
          type="button"
          onClick={requestActivation}
          disabled={status === 'sending'}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-900 text-sm font-bold px-4 py-2.5 transition disabled:opacity-60"
        >
          {status === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />} Pedir activación
        </button>
      )}
    </div>
  );
}
