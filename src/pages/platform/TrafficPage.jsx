import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { StatTile, TimeChart, RankedBars, SegmentedBar } from './charts';

// Tráfico de las tiendas: visitas, embudo de compra, productos y secciones más vistas,
// de dónde llegan y desde qué aparato. Todo anónimo (supabase/013_trafico.sql).
//  - Superadmin › Tráfico: toda la plataforma o una tienda, más la comparación entre tiendas.
//  - Panel de cada tienda › Estadísticas: solo esa tienda (storeId).
// La base decide quién ve qué (analytics_summary): el dueño, solo su tienda.

const PERIODS = [{ days: 7, label: '7 días' }, { days: 30, label: '30 días' }, { days: 90, label: '90 días' }];
const count = (v) => Number(v || 0).toLocaleString('es-AR');
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');

// Nombres claros para las secciones de la tienda
const PAGE_LABEL = { '/': 'Portada y catálogo', '/producto': 'Fichas de producto', '/nosotros': 'Nosotros', '/seguimiento': 'Seguimiento', '/login': 'Ingresar', '/perfil': 'Mi cuenta' };
const DEVICE_LABEL = { mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet' };

async function fetchAnalytics(days, store) {
  const { data, error } = await supabase.rpc('analytics_summary', { p_days: days, p_store_id: store || null });
  if (error) {
    if (/analytics_summary|function|schema cache/i.test(error.message || '')) throw new Error('Falta actualizar la base: corré supabase/013_trafico.sql en Supabase.');
    if (/autorizado/i.test(error.message || '')) throw new Error('No tenés acceso a estas estadísticas.');
    throw new Error('No se pudieron cargar los datos.');
  }
  return data;
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

export default function TrafficPage({ storeId = null }) {
  const ownStore = Boolean(storeId); // panel de una tienda: sin selector ni comparación
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState('');
  const store = storeId || picked;
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

  // La lista de tiendas llega con la vista de toda la plataforma: se guarda para el selector
  const [storeOptions, setStoreOptions] = useState([]);
  useEffect(() => { if (data?.stores?.length) setStoreOptions(data.stores); }, [data]);

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
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{ownStore ? 'Estadísticas' : 'Tráfico'}</h1>
          <p className="text-sm text-zinc-400 mt-1">{ownStore
            ? 'Cómo navegan tus visitantes: qué miran, de dónde llegan y cuántos terminan comprando.'
            : 'Cómo navegan los visitantes de las tiendas: qué miran, de dónde llegan y cuántos compran.'}</p>
        </div>
        {/* Filtros en una fila */}
        <div className="flex flex-wrap items-center gap-2">
          {!ownStore && (
            <select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Tienda"
              className="bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas las tiendas</option>
              {storeOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
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

          {!store && <StoreComparison stores={data.byStore || []} />}

          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="w-4 h-4 shrink-0" /> Datos anónimos: no se guarda IP, email ni nombre de los visitantes. No se cuenta la vista previa del panel{ownStore ? '' : ' ni la tienda de ejemplo de la página oficial'}.
          </p>
        </div>
      )}
    </div>
  );
}

// Superadmin: comparación entre tiendas activas (visitas, interés y conversión)
function StoreComparison({ stores }) {
  if (!stores.length) return null;
  return (
    <Card title="Comparación de tiendas" subtitle="Ordenadas por visitas. Conversión: de cada 100 visitas, cuántas hicieron un pedido.">
      <div className="grid lg:grid-cols-2 gap-8">
        <RankedBars items={stores.slice(0, 10).map(s => ({ label: s.name, detail: `${count(s.orders)} pedidos`, value: s.visits }))} format={count} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/10">
                <th className="text-left font-bold py-2 pr-3">Tienda</th>
                <th className="text-right font-bold py-2 px-2">Visitas</th>
                <th className="text-right font-bold py-2 px-2">Productos vistos</th>
                <th className="text-right font-bold py-2 px-2">Al carrito</th>
                <th className="text-right font-bold py-2 px-2">Pedidos</th>
                <th className="text-right font-bold py-2 pl-2">Conversión</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(s => (
                <tr key={s.id} className="border-b border-white/5 text-zinc-300">
                  <td className="py-2 pr-3 text-white font-semibold truncate max-w-[10rem]">{s.name}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{count(s.visits)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{count(s.productViews)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{pct(s.addToCart, s.visits)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{count(s.orders)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-bold text-white">{pct(s.orders, s.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
