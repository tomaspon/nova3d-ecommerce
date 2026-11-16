import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw, ShieldCheck, ArrowDown, ArrowUp, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatMoney } from '../../pricing';
import { StatTile, TimeChart, RankedBars, SegmentedBar, VIZ } from './charts';
import LivePanel from './LivePanel';

// Estadísticas de las tiendas, con todo lo que hacen los visitantes (supabase/013 y 014):
// embudo completo hasta el pago, abandonos, cada producto, búsquedas, horarios y más.
//  - Superadmin › Tráfico: toda la plataforma o una tienda, más la comparación entre tiendas.
//  - Panel de cada tienda › Estadísticas: solo esa tienda (storeId).
// La base decide quién ve qué (analytics_summary): el dueño, solo su tienda. Todo es anónimo.

const PERIODS = [{ days: 1, label: 'Hoy' }, { days: 7, label: '7 días' }, { days: 30, label: '30 días' }, { days: 90, label: '90 días' }];
const count = (v) => Number(v || 0).toLocaleString('es-AR');
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');
const duration = (s) => {
  const secs = Math.round(Number(s) || 0);
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  return m ? `${m} min ${secs % 60} s` : `${secs} s`;
};

const PAGE_LABEL = { '/': 'Portada y catálogo', '/producto': 'Fichas de producto', '/nosotros': 'Nosotros', '/seguimiento': 'Seguimiento', '/login': 'Ingresar', '/perfil': 'Mi cuenta' };
const DEVICE_LABEL = { mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet' };
const DAY_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Cada cosa que se registra, con su nombre para la tabla "Todo lo que pasó"
const EVENT_LABEL = {
  page_view: 'Páginas vistas', search: 'Búsquedas', category_filter: 'Elegir categoría', sort_change: 'Cambiar el orden',
  banner_click: 'Clic en el banner de la oferta', product_view: 'Productos abiertos', variant_select: 'Elegir talle',
  add_to_cart: 'Agregar al carrito', remove_from_cart: 'Sacar del carrito', favorite_add: 'Agregar a favoritos',
  share_click: 'Compartir producto', checkout_start: 'Abrir el checkout', payment_select: 'Elegir medio de pago',
  checkout_confirm: 'Tocar "Confirmar pedido"', order_placed: 'Pedidos creados', order_error: 'Pedidos que fallaron',
  mp_redirect: 'Ir a pagar a MercadoPago', whatsapp_click: 'Clic en WhatsApp', login: 'Iniciar sesión', signup: 'Crear cuenta'
};

async function fetchAnalytics(days, store) {
  const { data, error } = await supabase.rpc('analytics_summary', { p_days: days, p_store_id: store || null });
  if (error) {
    if (/analytics_summary|function|schema cache/i.test(error.message || '')) throw new Error('Falta actualizar la base: corré supabase/013_trafico.sql y 014_trafico_detallado.sql en Supabase.');
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

function SectionTitle({ children }) {
  return <h2 className="pt-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">{children}</h2>;
}

export default function TrafficPage({ storeId = null }) {
  const ownStore = Boolean(storeId);
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState('');
  const store = storeId || picked;
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeOptions, setStoreOptions] = useState([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try { setData(await fetchAnalytics(days, store)); }
    catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  }, [days, store]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.stores?.length) setStoreOptions(data.stores); }, [data]);

  const t = data?.totals || {};
  const f = data?.funnel || {};
  const o = data?.orders || {};
  const labels = data?.labels || {};
  const funnelSteps = [
    ['Entraron a la tienda', f.visits],
    ['Abrieron un producto', f.viewedProduct],
    ['Agregaron al carrito', f.addedToCart],
    ['Abrieron el checkout', f.startedCheckout],
    ['Tocaron "Confirmar pedido"', f.confirmed],
    ['Hicieron el pedido', f.ordered],
    ['Lo pagaron', f.paid]
  ].map(([label, value], i, all) => {
    const prev = i ? all[i - 1][1] || 0 : null;
    const lost = prev !== null ? Math.max(prev - (value || 0), 0) : 0;
    return { label, value: value || 0, detail: `${pct(value || 0, f.visits)}${i && lost ? ` · se perdieron ${count(lost)}` : ''}` };
  });
  const labelBars = (key) => (labels[key] || []).map(x => ({ label: x.label, value: x.count }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{ownStore ? 'Estadísticas' : 'Tráfico'}</h1>
          <p className="text-sm text-zinc-400 mt-1">{ownStore
            ? 'Todo lo que hacen tus visitantes: qué miran, qué agregan, dónde abandonan y cuántos terminan pagando.'
            : 'Todo lo que hacen los visitantes de las tiendas: qué miran, qué agregan, dónde abandonan y cuántos pagan.'}</p>
        </div>
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

      {/* Lo que pasa ahora, arriba de todo (se actualiza solo) */}
      <LivePanel key={store || 'todas'} storeId={store || null} showStore={!store} />

      {error ? (
        <div className="p-10 text-center bg-black border border-white/10 rounded-2xl">
          <AlertTriangle className="w-10 h-10 text-amber-400/70 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 max-w-md mx-auto">{error}</p>
        </div>
      ) : !data ? (
        <div className="p-12 flex items-center justify-center gap-3 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando estadísticas...</div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <SectionTitle>Visitas</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label="Visitas" value={count(t.visits)} hint={days === 1 ? 'Hoy' : `Últimos ${data.days} días`} />
            <StatTile label="Páginas por visita" value={Number(t.pagesPerVisit || 0).toLocaleString('es-AR')} hint={`${count(t.pageViews)} páginas vistas`} />
            <StatTile label="Tiempo por visita" value={duration(t.avgSeconds)} hint="Promedio, de las que navegaron" />
            <StatTile label="Se fueron sin mirar" value={pct(Number(t.bounceRate || 0) * 100, 100)} hint="Una página y ningún producto" />
            <StatTile label="Productos abiertos" value={count(data.events?.product_view)} />
          </div>

          <SectionTitle>Ventas</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatTile label="Pedidos hechos" value={count(o.placed)} />
            <StatTile label="Pagados" value={count(o.paid)} hint={pct(o.paid, o.placed) + ' de los pedidos'} />
            <StatTile label="Sin pagar" value={count(o.waiting)} hint="Todavía pueden pagar" />
            <StatTile label="Vencidos o cancelados" value={count(o.canceled)} />
            <StatTile label="Facturado" value={formatMoney(o.revenue)} hint={`Ticket promedio ${formatMoney(o.avgTicket)}`} />
            <StatTile label="Visitas que pagaron" value={pct(f.paid, f.visits)} hint="Conversión real" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Visitas por día" subtitle="Cada visita es una persona navegando (una pestaña).">
              <TimeChart data={data.daily} valueKey="visits" format={count} type={data.days > 31 ? 'area' : 'bars'} label="Visitas" />
            </Card>
            <Card title="Pedidos por día" subtitle="Visitas que terminaron en un pedido.">
              <TimeChart data={data.daily} valueKey="orders" format={count} type="bars" label="Pedidos" />
            </Card>
          </div>

          <SectionTitle>Compra y abandono</SectionTitle>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Embudo completo" subtitle="Visitas que llegaron a cada paso, del ingreso al pago, y cuántas se perdieron en el camino.">
              <RankedBars items={funnelSteps} format={count} empty="Todavía no hay visitas en este período." />
            </Card>
            <Card title="Dónde abandonan" subtitle="Visitas que empezaron algo y no lo terminaron.">
              <div className="grid grid-cols-2 gap-3">
                <AbandonTile label="Carritos abandonados" value={t.abandonedCarts} hint="Agregaron y no abrieron el checkout" />
                <AbandonTile label="No confirmaron" value={t.abandonedCheckouts} hint='Abrieron el checkout y no tocaron "Confirmar"' />
                <AbandonTile label="El pedido falló" value={t.failedConfirms} hint="Tocaron confirmar y dio error" />
                <AbandonTile label="Pedidos sin pagar" value={(o.waiting || 0) + (o.canceled || 0)} hint="Se crearon y no se pagaron" />
              </div>
              {(labels.order_error || []).length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-bold text-zinc-400 mb-2">Por qué fallaron los pedidos</p>
                  <RankedBars items={labelBars('order_error')} format={count} />
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Medios de pago" subtitle="Elegidos en el checkout · pedidos hechos y pagados con cada uno.">
              <RankedBars
                items={(o.byMethod || []).map(m => ({ label: m.method, detail: `${count(m.paid)} pagados`, value: m.placed }))}
                format={count}
                empty="Todavía no hay pedidos en este período."
              />
              {(labels.payment_select || []).length > 0 && (
                <p className="mt-4 text-xs text-zinc-500">
                  Elegidos en el checkout: {(labels.payment_select || []).map(x => `${x.label} ${count(x.count)}`).join(' · ')}
                </p>
              )}
            </Card>
            <Card title="Horarios" subtitle="Visitas por día de la semana y hora (hora de Argentina).">
              <Heatmap cells={data.heatmap || []} />
            </Card>
          </div>

          <SectionTitle>Productos</SectionTitle>
          <Card title="Cada producto" subtitle="Tocá una columna para ordenar. Abandonados: agregados al carrito en visitas que no terminaron en pedido.">
            <ProductsTable products={data.products || []} showStore={!store} />
          </Card>

          <SectionTitle>Qué buscan y cómo navegan</SectionTitle>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card title="Lo más buscado"><RankedBars items={labelBars('search')} format={count} empty="Nadie buscó todavía." /></Card>
            <Card title="Categorías elegidas"><RankedBars items={labelBars('category_filter')} format={count} empty="Nadie filtró por categoría." /></Card>
            <Card title="Talles elegidos"><RankedBars items={labelBars('variant_select')} format={count} empty="Sin talles elegidos." /></Card>
            <Card title="Secciones más vistas">
              <RankedBars items={(data.topPages || []).map(p => ({ label: PAGE_LABEL[p.path] || p.path, value: p.views }))} format={count} />
            </Card>
            <Card title="De dónde llegan" subtitle="Visitas · pedidos. Directo: escribieron la dirección o abrieron un link guardado.">
              <RankedBars items={(data.sources || []).map(s => ({ label: s.source, detail: `${count(s.orders)} pedidos`, value: s.visits }))} format={count} />
            </Card>
            <Card title="Desde qué aparato">
              <SegmentedBar parts={(data.devices || []).map(d => ({ label: DEVICE_LABEL[d.device] || d.device, value: d.visits }))} format={count} />
            </Card>
            <Card title="Orden elegido en el catálogo"><RankedBars items={labelBars('sort_change')} format={count} empty="Nadie cambió el orden." /></Card>
            <Card title="Clics en WhatsApp"><RankedBars items={labelBars('whatsapp_click')} format={count} empty="Sin clics en WhatsApp." /></Card>
            <Card title="Cuentas"><RankedBars items={[
              { label: 'Iniciaron sesión', value: data.events?.login || 0 },
              { label: 'Crearon cuenta', value: data.events?.signup || 0 },
              { label: 'Agregaron a favoritos', value: data.events?.favorite_add || 0 }
            ]} format={count} /></Card>
          </div>

          {!store && <StoreComparison stores={data.byStore || []} />}

          <Card title="Todo lo que pasó" subtitle="Cuántas veces ocurrió cada cosa en el período.">
            <EventsTable events={data.events || {}} />
          </Card>

          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="w-4 h-4 shrink-0" /> Datos anónimos: no se guarda IP, email ni nombre de los visitantes. No se cuenta la vista previa del panel{ownStore ? '' : ' ni la tienda de ejemplo de la página oficial'}.
          </p>
        </div>
      )}
    </div>
  );
}

function AbandonTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white tabular-nums">{count(value)}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500 leading-snug">{hint}</p>
    </div>
  );
}

// Mapa de calor: una sola tonalidad, más intensa = más visitas
function Heatmap({ cells }) {
  const grid = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of cells) if (c.dow >= 1 && c.dow <= 7) m[c.dow - 1][c.hour] = c.visits;
    return m;
  }, [cells]);
  const max = Math.max(1, ...grid.flat());
  if (!cells.length) return <p className="py-8 text-center text-sm text-zinc-500">Todavía no hay visitas en este período.</p>;
  const busiest = grid.flatMap((row, d) => row.map((v, h) => ({ d, h, v }))).sort((a, b) => b.v - a.v)[0];
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-[9px] text-zinc-500 text-center">{h % 3 === 0 ? h : ''}</span>)}
            {grid.map((row, d) => (
              <div key={d} className="contents">
                <span className="text-[10px] text-zinc-400 self-center">{DAY_LABEL[d]}</span>
                {row.map((v, h) => (
                  <span key={h} title={`${DAY_LABEL[d]} ${h}:00 a ${h + 1}:00 · ${count(v)} visitas`}
                    className="aspect-square rounded-[3px]"
                    style={{ background: v ? VIZ.series[0] : 'rgba(255,255,255,0.04)', opacity: v ? 0.18 + 0.82 * (v / max) : 1 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>Más visitas: <b className="text-zinc-300">{DAY_LABEL[busiest.d]} de {busiest.h} a {busiest.h + 1} h</b></span>
        <span className="flex items-center gap-1.5">menos
          {[0.25, 0.5, 0.75, 1].map(op => <span key={op} className="w-3 h-3 rounded-[3px]" style={{ background: VIZ.series[0], opacity: 0.18 + 0.82 * op }} />)}
          más</span>
      </div>
    </div>
  );
}

const PRODUCT_COLUMNS = [
  { key: 'views', label: 'Vistas' },
  { key: 'viewers', label: 'Personas' },
  { key: 'addToCart', label: 'Al carrito' },
  { key: 'removes', label: 'Sacados' },
  { key: 'favorites', label: 'Favoritos' },
  { key: 'abandoned', label: 'Abandonados' },
  { key: 'unitsOrdered', label: 'Pedidas' },
  { key: 'unitsPaid', label: 'Pagadas' },
  { key: 'revenue', label: 'Facturado', money: true },
  { key: 'conversion', label: 'Conversión' }
];

function ProductsTable({ products, showStore }) {
  const [sort, setSort] = useState({ key: 'views', dir: 'desc' });
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .map(p => ({ ...p, conversion: p.viewers ? p.unitsOrdered / p.viewers : 0 }))
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (Number(a[sort.key]) - Number(b[sort.key])) * (sort.dir === 'asc' ? 1 : -1));
  }, [products, sort, query]);
  if (!products.length) return <p className="py-8 text-center text-sm text-zinc-500">Todavía nadie abrió un producto en este período.</p>;
  const toggle = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="space-y-3">
      <label className="relative block max-w-xs">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto"
          className="w-full bg-black border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
      </label>
      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/10">
              <th className="text-left font-bold py-2 px-5 sm:pl-0">Producto</th>
              {PRODUCT_COLUMNS.map(c => (
                <th key={c.key} className="text-right font-bold py-2 px-2">
                  <button type="button" onClick={() => toggle(c.key)} className={`inline-flex items-center gap-1 uppercase tracking-widest hover:text-white ${sort.key === c.key ? 'text-white' : ''}`}>
                    {c.label}
                    {sort.key === c.key && (sort.dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-b border-white/5 text-zinc-300">
                <td className="py-2.5 px-5 sm:pl-0 min-w-[12rem]">
                  <span className="block text-white font-semibold truncate max-w-[16rem]">{p.name}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {[showStore && p.store, p.price != null && formatMoney(p.price), p.stock != null && `stock ${p.stock}`, p.active === false && 'pausado'].filter(Boolean).join(' · ')}
                    {p.soldOutViews > 0 && <span className="text-amber-400"> · lo vieron agotado {count(p.soldOutViews)} veces</span>}
                  </span>
                </td>
                {PRODUCT_COLUMNS.map(c => (
                  <td key={c.key} className={`py-2.5 px-2 text-right tabular-nums ${c.key === 'abandoned' && p.abandoned ? 'text-amber-300' : ''}`}>
                    {c.key === 'conversion' ? (p.viewers ? `${Math.round(p.conversion * 100)}%` : '—') : c.money ? formatMoney(p[c.key]) : count(p[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500">Conversión: unidades pedidas por cada persona que abrió el producto.</p>
    </div>
  );
}

function EventsTable({ events }) {
  const rows = Object.keys(EVENT_LABEL).map(key => ({ key, label: EVENT_LABEL[key], value: events[key] || 0 }));
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6">
      {rows.map(r => (
        <div key={r.key} className="flex items-baseline justify-between gap-3 py-2 border-b border-white/5 text-sm">
          <span className="text-zinc-400">{r.label}</span>
          <span className="text-white font-semibold tabular-nums">{count(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Superadmin: comparación entre tiendas activas
function StoreComparison({ stores }) {
  if (!stores.length) return null;
  return (
    <Card title="Comparación de tiendas" subtitle="Ordenadas por visitas. Conversión: de cada 100 visitas, cuántas hicieron un pedido.">
      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/10">
              <th className="text-left font-bold py-2 px-5 sm:pl-0">Tienda</th>
              <th className="text-right font-bold py-2 px-2">Visitas</th>
              <th className="text-right font-bold py-2 px-2">Productos vistos</th>
              <th className="text-right font-bold py-2 px-2">Al carrito</th>
              <th className="text-right font-bold py-2 px-2">Pedidos</th>
              <th className="text-right font-bold py-2 px-2">Pagados</th>
              <th className="text-right font-bold py-2 px-2">Facturado</th>
              <th className="text-right font-bold py-2 pl-2 pr-5 sm:pr-0">Conversión</th>
            </tr>
          </thead>
          <tbody>
            {stores.map(s => (
              <tr key={s.id} className="border-b border-white/5 text-zinc-300">
                <td className="py-2 px-5 sm:pl-0 text-white font-semibold">{s.name}</td>
                <td className="py-2 px-2 text-right tabular-nums">{count(s.visits)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{count(s.productViews)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{pct(s.addToCart, s.visits)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{count(s.orders)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{count(s.paid)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatMoney(s.revenue)}</td>
                <td className="py-2 pl-2 pr-5 sm:pr-0 text-right tabular-nums font-bold text-white">{pct(s.orders, s.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
