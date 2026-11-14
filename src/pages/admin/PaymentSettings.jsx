import { useEffect, useState } from 'react';
import { CreditCard, Landmark, MessageCircle, Loader2, CheckCircle2, AlertTriangle, Link2, Unlink } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { DEFAULT_STORE_ID } from '../../storeIds';

// Cobros de la tienda: su cuenta de MercadoPago (conexión con un clic, OAuth) y los datos
// para recibir transferencias y avisos por WhatsApp.

async function callMp(action, storeId) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/mp-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify({ action, storeId })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'La conexión con MercadoPago funciona en la versión publicada.' : body.message || 'No se pudo completar la acción.');
  }
  return body;
}

const RESULT_MESSAGES = {
  conectado: { ok: true, text: '¡Listo! Tu cuenta de MercadoPago quedó conectada.' },
  cancelado: { ok: false, text: 'Cancelaste la conexión en MercadoPago. Podés intentarlo de nuevo.' },
  invalido: { ok: false, text: 'El enlace de conexión venció. Volvé a tocar "Conectar".' },
  error: { ok: false, text: 'MercadoPago no confirmó la conexión. Probá de nuevo en un momento.' }
};

const inputClass = 'w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition';

export default function PaymentSettings() {
  const { store, storeId, storeSettings, updateStoreSettings } = useStore();
  const [status, setStatus] = useState(null); // { configured, connected, account }
  const [statusError, setStatusError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [form, setForm] = useState({ transfer_alias: '', transfer_cbu: '', transfer_holder: '', contact_whatsapp: '' });
  const [saveState, setSaveState] = useState('idle');
  const [result] = useState(() => RESULT_MESSAGES[new URLSearchParams(window.location.search).get('mp')] || null);

  useEffect(() => {
    setForm({
      transfer_alias: storeSettings.transfer_alias || '',
      transfer_cbu: storeSettings.transfer_cbu || '',
      transfer_holder: storeSettings.transfer_holder || '',
      contact_whatsapp: storeSettings.contact_whatsapp || ''
    });
  }, [storeSettings.transfer_alias, storeSettings.transfer_cbu, storeSettings.transfer_holder, storeSettings.contact_whatsapp]);

  useEffect(() => {
    if (!storeId) return;
    callMp('status', storeId).then(setStatus).catch(err => setStatusError(err.message));
  }, [storeId]);

  const connect = async () => {
    setIsWorking(true);
    try {
      const { url } = await callMp('start', storeId);
      window.location.href = url;
    } catch (err) {
      setStatusError(err.message);
      setIsWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar MercadoPago? Tus clientes no van a poder pagar con MercadoPago hasta que la vuelvas a conectar.')) return;
    setIsWorking(true);
    try {
      await callMp('disconnect', storeId);
      setStatus(prev => ({ ...prev, connected: false, account: null }));
    } catch (err) {
      setStatusError(err.message);
    }
    setIsWorking(false);
  };

  const saveTransfer = async (e) => {
    e.preventDefault();
    setSaveState('saving');
    const ok = await updateStoreSettings(form);
    setSaveState(ok ? 'saved' : 'error');
    if (ok) setTimeout(() => setSaveState('idle'), 2500);
  };

  const usesPlatformAccount = storeId === DEFAULT_STORE_ID && status && !status.connected;
  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Cobros</h2>
        <p className="text-zinc-400 text-sm mt-1">Cómo te pagan tus clientes. El carrito muestra solo lo que configures acá.</p>
      </div>

      {result && (
        <div className={`flex gap-3 rounded-xl p-4 text-sm ${result.ok ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-100 border border-amber-500/20'}`}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />} {result.text}
        </div>
      )}

      {/* MercadoPago */}
      <div className="rounded-xl border border-white/10 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-11 h-11 rounded-xl bg-[#009EE3]/15 text-[#4CC3FF] flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white">MercadoPago</p>
            <p className="text-sm text-zinc-400">
              {!status && !statusError && 'Revisando la conexión...'}
              {statusError && <span className="text-amber-300">{statusError}</span>}
              {status?.connected && <>Conectado{status.account?.mp_user_id ? ` (cuenta ${status.account.mp_user_id})` : ''}. La plata de cada venta va directo a tu cuenta.</>}
              {usesPlatformAccount && 'Cobrando con la cuenta de la plataforma. Conectá la tuya para recibir los pagos directo.'}
              {status && !status.connected && !usesPlatformAccount && 'No conectado: tus clientes no pueden pagar con MercadoPago.'}
            </p>
          </div>
          {status?.connected ? (
            <button type="button" onClick={disconnect} disabled={isWorking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-bold text-zinc-300 transition disabled:opacity-50">
              <Unlink className="w-4 h-4" /> Desconectar
            </button>
          ) : (
            <button type="button" onClick={connect} disabled={isWorking || !status?.configured} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009EE3] hover:bg-[#0088C7] px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50">
              {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Conectar con Mercado Pago
            </button>
          )}
        </div>
        {status && !status.configured && (
          <p className="mt-4 text-xs text-zinc-500">La conexión todavía no está habilitada en la plataforma. Mientras tanto, cargá tus datos de transferencia.</p>
        )}
        {!status?.connected && status?.configured && (
          <p className="mt-4 text-xs text-zinc-500">Te lleva a MercadoPago para que inicies sesión y autorices. No tenés que copiar ninguna clave.</p>
        )}
      </div>

      {/* Transferencia y contacto */}
      <form onSubmit={saveTransfer} className="rounded-xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0"><Landmark className="w-5 h-5" /></span>
          <div>
            <p className="font-bold text-white">Transferencia</p>
            <p className="text-sm text-zinc-400">Se le muestra al comprador para que te transfiera. Vos confirmás el pago en Órdenes.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-bold text-zinc-400 mb-1.5">Alias</span>
            <input className={inputClass} value={form.transfer_alias} onChange={set('transfer_alias')} placeholder="mi.tienda.mp" />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-zinc-400 mb-1.5">CBU o CVU (opcional)</span>
            <input className={`${inputClass} font-mono`} inputMode="numeric" value={form.transfer_cbu} onChange={set('transfer_cbu')} />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-zinc-400 mb-1.5">Titular de la cuenta</span>
            <input className={inputClass} value={form.transfer_holder} onChange={set('transfer_holder')} placeholder="Nombre y apellido" />
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 mb-1.5"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp de la tienda</span>
            <input className={inputClass} type="tel" value={form.contact_whatsapp} onChange={set('contact_whatsapp')} placeholder="5492915551234" />
            <span className="block mt-1 text-[11px] text-zinc-500">Con código de país y sin espacios. Ahí te mandan los comprobantes.</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saveState === 'saved' && <span className="text-sm text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          {saveState === 'error' && <span className="text-sm text-red-400">No se pudo guardar.</span>}
          <button type="submit" disabled={saveState === 'saving'} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-50">
            {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
          </button>
        </div>
      </form>
      {store?.isDemo && <p className="text-xs text-zinc-500">Tienda de ejemplo: los cambios no se guardan.</p>}
    </div>
  );
}
