import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { StatTile, TimeChart, RankedBars, SegmentedBar } from './charts';

// Superadmin › Tráfico: visitas, embudo de compra, productos y secciones más vistas,
// de dónde llegan y desde qué aparato. Todo anónimo (supabase/013_trafico.sql).

const PERIODS = [{ days: 7, label: '7 días' }, { days: 30, label: '30 días' }, { days: 90, label: '90 días' }];
const count = (v) => Number(v || 0).toLocaleString('es-AR');
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');

// Nombres claros para las secciones de la tienda
const PAGE_LABEL = { '/': 'Portada y catálogo', '/producto': 'Fichas de producto', '/nosotros': 'Nosotros', '/seguimiento': 'Seguimiento', '/login': 'Ingresar', '/perfil': 'Mi cuenta' };
const DEVICE_LABEL = { mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet' };

async function fetchAnalytics(days, store) {
  const { data } = await supabase.auth.getSession();
  const params = new URLSearchParams({ days: String(days) });
  if (store) params.set('store', store);
  const response = await fetch(`/api/platform-analytics?${params}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'El tráfico se ve en la versión publicada (necesita las funciones de Vercel).' : body.message || 'No se pudieron cargar los datos.');
  }
  return body;
}

function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`bg-black border border-white/10 rounded-2xl p-5 sm:p-6 min-w-0 ${className}`}>
      <h2 className="font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function TrafficPage() {
  const [days, setDays] = useState(30);
  const [store, setStore] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try { setData(await fetchAnalytics(days, store)); }
    catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  }, [days, store]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const f = data?.funnel || {};
  const funnel = [
    { label: 'Entraron a la tienda', value: f.visits || 0 },
    { label: 'Vieron un producto', value: f.viewedProduct || 0 },
    { label: 'Agregaron al carrito', value: f.addedToCart || 0 },
    { label: 'Empezaron a comprar', value: f.startedCheckout || 0 },
    { label: 'Hicieron el pedido', value: f.ordered || 0 }
  ].map(step => ({ ...step, detail: pct(step.value, f.visits) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Tráfico</h1>
          <p className="text-sm text-zinc-400 mt-1">Cómo navegan los visitantes de las tiendas: qué miran, de dónde llegan y cuántos compran.</p>
        </div>
        {/* Filtros en una fila */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={store} onChange={(e) => setStore(e.target.value)} aria-label="Tienda"
            className="bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="">Todas las tiendas</option>
            {(data?.stores || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1" role="group" aria-label="Período">
            {PERIODS.map(p => (
              <button key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${days === p.days ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} disabled={isLoading} aria-label="Actualizar" className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-10 text-center bg-black border border-white/10 rounded-2xl">
          <AlertTriangle className="w-10 h-10 text-amber-400/70 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 max-w-md mx-auto">{error}</p>
        </div>
      ) : !data ? (
        <div className="p-12 flex items-center justify-center gap-3 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando tráfico...</div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label="Visitas" value={count(t.visits)} hint={`Últimos ${data.days} días`} />
            <StatTile label="Páginas vistas" value={count(t.pageViews)} hint={t.visits ? `${(t.pageViews / t.visits).toFixed(1)} por visita` : '—'} />
            <StatTile label="Productos vistos" value={count(t.productViews)} />
            <StatTile label="Agregados al carrito" value={count(t.addToCart)} />
            <StatTile label="Pedidos" value={count(t.orders)} hint={`Conversión ${pct(f.ordered, f.visits)}`} />
          </div>

          <Card title="Visitas por día" subtitle="Cada visita es una persona navegando (una pestaña), sin importar cuántas páginas vea.">
            <TimeChart data={data.daily} valueKey="visits" format={count} type={data.days > 31 ? 'area' : 'bars'} label="Visitas" />
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Embudo de compra" subtitle="De cada 100 visitas, cuántas llegan a cada paso.">
              <RankedBars items={funnel} format={count} empty="Todavía no hay visitas en este período." />
            </Card>
            <Card title="Productos más vistos" subtitle="Veces que se abrió su ficha · agregados al carrito.">
              <RankedBars
                items={(data.topProducts || []).map(p => ({ label: p.name, detail: `${!store && p.store ? `${p.store} · ` : ''}${count(p.addToCart)} al carrito`, value: p.views }))}
                format={count}
                empty="Todavía nadie abrió un producto en este período."
              />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card title="Secciones más vistas">
              <RankedBars items={(data.topPages || []).map(p => ({ label: PAGE_LABEL[p.path] || p.path, value: p.views }))} format={count} />
            </Card>
            <Card title="De dónde llegan" subtitle="Directo: escribieron la dirección o abrieron un link guardado.">
              <RankedBars items={(data.sources || []).map(s => ({ label: s.source, value: s.visits }))} format={count} />
            </Card>
            <Card title="Desde qué aparato">
              <SegmentedBar parts={(data.devices || []).map(d => ({ label: DEVICE_LABEL[d.device] || d.device, value: d.visits }))} format={count} />
            </Card>
          </div>

          {!store && (
            <Card title="Tiendas con más visitas" subtitle="Visitas · pedidos hechos en el período.">
              <RankedBars items={(data.byStore || []).map(s => ({ label: s.name, detail: `${count(s.orders)} pedidos`, value: s.visits }))} format={count} />
            </Card>
          )}

          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="w-4 h-4 shrink-0" /> Datos anónimos: no se guarda IP, email ni nombre de los visitantes. No se cuentan la vista previa del panel ni la tienda de ejemplo de la página oficial.
          </p>
        </div>
      )}
    </div>
  );
}
