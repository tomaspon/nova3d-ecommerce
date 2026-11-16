import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Smartphone, Monitor, Tablet } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { VIZ } from './charts';

// Estadísticas › En vivo: lo que pasa ahora en la tienda (o en todas). Pide un resumen chico
// cada 10 segundos (analytics_live, 014): con poco o mucho tráfico, siempre es el mismo tamaño.
// Solo se actualiza con la pestaña a la vista, y se puede pausar.

const EVERY_MS = 10000;
const count = (v) => Number(v || 0).toLocaleString('es-AR');
const PAGE = { '/': 'la portada', '/nosotros': 'Nosotros', '/seguimiento': 'Seguimiento', '/login': 'Ingresar', '/perfil': 'Mi cuenta' };
const DEVICE_ICON = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };

// Cada evento contado en palabras
export function describeEvent(e) {
  const p = e.product || 'un producto';
  switch (e.type) {
    case 'page_view': return e.path?.startsWith('/producto/') ? 'abrió una ficha de producto' : `entró a ${PAGE[e.path] || e.path || 'la tienda'}`;
    case 'search': return `buscó "${e.label}"`;
    case 'category_filter': return `filtró por ${e.label}`;
    case 'sort_change': return `ordenó por ${(e.label || '').toLowerCase()}`;
    case 'banner_click': return 'tocó el banner de la oferta';
    case 'product_view': return `miró ${p}${e.label === 'agotado' ? ' (agotado)' : ''}`;
    case 'variant_select': return `eligió el talle ${e.label} de ${p}`;
    case 'add_to_cart': return `agregó ${p}${e.label ? ` (${e.label})` : ''} al carrito`;
    case 'remove_from_cart': return `sacó ${p} del carrito`;
    case 'favorite_add': return `guardó ${p} en favoritos`;
    case 'share_click': return `compartió ${p}`;
    case 'checkout_start': return 'abrió el checkout';
    case 'payment_select': return `eligió pagar con ${e.label}`;
    case 'checkout_confirm': return `tocó "Confirmar pedido"${e.label ? ` (${e.label})` : ''}`;
    case 'order_placed': return 'hizo un pedido';
    case 'order_error': return `no pudo hacer el pedido: ${e.label || 'error'}`;
    case 'mp_redirect': return 'fue a pagar a MercadoPago';
    case 'whatsapp_click': return `tocó WhatsApp${e.label ? ` (${e.label})` : ''}`;
    case 'login': return 'inició sesión';
    case 'signup': return 'creó una cuenta';
    default: return e.type;
  }
}

const TONE = { order_placed: 'text-emerald-300', order_error: 'text-red-300', checkout_confirm: 'text-indigo-200', add_to_cart: 'text-white' };

function ago(at, serverTime) {
  const s = Math.max(0, Math.round((new Date(serverTime) - new Date(at)) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  return `hace ${m} min`;
}

export default function LivePanel({ storeId = null, showStore = false }) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (document.hidden) return; // no se pide nada con la pestaña oculta
    const { data, error: rpcError } = await supabase.rpc('analytics_live', { p_store_id: storeId });
    if (rpcError) {
      setError(/analytics_live|function|schema cache/i.test(rpcError.message || '')
        ? 'Para ver la actividad en vivo, corré supabase/014_trafico_detallado.sql en Supabase.'
        : 'No se pudo cargar la actividad en vivo.');
      return;
    }
    setError('');
    setLive(data);
  }, [storeId]);

  useEffect(() => {
    if (paused) return;
    load();
    timer.current = setInterval(load, EVERY_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, paused]);

  if (error) return <p className="rounded-2xl border border-white/10 bg-black p-4 text-sm text-zinc-400">{error}</p>;
  if (!live) return null;

  const minutes = live.perMinute || [];
  const max = Math.max(1, ...minutes.map(m => m.visits));

  return (
    <section className="bg-black border border-white/10 rounded-2xl p-5 sm:p-6 min-w-0" aria-label="Actividad en vivo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-white flex items-center gap-2.5">
          <span className="relative flex w-2.5 h-2.5">
            {!paused && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
            <span className={`relative inline-flex rounded-full w-2.5 h-2.5 ${paused ? 'bg-zinc-500' : 'bg-emerald-400'}`} />
          </span>
          En vivo
          <span className="text-xs font-normal text-zinc-500">{paused ? 'pausado' : 'se actualiza cada 10 segundos'}</span>
        </h2>
        <button type="button" onClick={() => setPaused(p => !p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white">
          {paused ? <><Play className="w-3.5 h-3.5" /> Seguir</> : <><Pause className="w-3.5 h-3.5" /> Pausar</>}
        </button>
      </div>

      <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
        <div className="space-y-5 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Navegando ahora', live.activeNow, 'últimos 5 min'],
              ['Con carrito', live.withCart, 'ahora'],
              ['En el checkout', live.inCheckout, 'ahora'],
              ['Pedidos', live.ordersLast30, 'últimos 30 min']
            ].map(([label, value, hint]) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate">{label}</p>
                <p className="mt-1 text-3xl font-black text-white tabular-nums leading-none">{count(value)}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Visitas por minuto · últimos 30 minutos</p>
            <div className="flex items-end gap-[2px] h-14" role="img" aria-label={`Visitas por minuto en los últimos 30 minutos. Ahora: ${count(minutes[minutes.length - 1]?.visits)}`}>
              {minutes.map(m => (
                <span key={m.minutesAgo} title={`${m.minutesAgo ? `hace ${m.minutesAgo} min` : 'este minuto'} · ${count(m.visits)} visitas`}
                  className="flex-1 rounded-t-[3px]"
                  style={{ height: `${Math.max((m.visits / max) * 100, m.visits ? 6 : 2)}%`, background: m.visits ? VIZ.series[0] : 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600"><span>hace 30 min</span><span>ahora</span></div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs text-zinc-500 mb-2">Lo último que pasó</p>
          {(live.recent || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nadie navegó en los últimos 30 minutos.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-white/5 pr-1">
              {live.recent.map((e, i) => {
                const Icon = DEVICE_ICON[e.device] || Monitor;
                return (
                  <li key={`${e.at}-${i}`} className="flex items-start gap-2.5 py-2 text-sm">
                    <Icon className="w-3.5 h-3.5 mt-0.5 text-zinc-500 shrink-0" aria-label={e.device === 'mobile' ? 'Celular' : e.device === 'tablet' ? 'Tablet' : 'Computadora'} />
                    <span className={`flex-1 min-w-0 ${TONE[e.type] || 'text-zinc-300'}`}>
                      Alguien {describeEvent(e)}{showStore && e.store ? <span className="text-zinc-500"> · {e.store}</span> : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">{ago(e.at, live.serverTime)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
