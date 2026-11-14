import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatMoney } from '../../pricing';
import { STORE_TEMPLATES } from '../../platformStores';
import { StatTile, TimeChart, MultiLineChart, RankedBars, SegmentedBar, Meter, VIZ } from './charts';

// Resumen de toda la plataforma: cifras, ventas en el tiempo, tiendas, productos y pedidos.

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' }
];

// Montos cortos para los ejes: $1,2 M, $350 mil
const shortMoney = (v, axis) => {
  if (!axis) return formatMoney(v);
  if (v >= 1e6) return `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (v >= 1e3) return `$${(v / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`;
  return `$${Math.round(v)}`;
};
const count = (v) => Math.round(v).toLocaleString('es-AR');
const templateLabel = (id) => STORE_TEMPLATES.find(t => t.id === id)?.label || id;
const date = (v) => (v ? new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`bg-black border border-white/10 rounded-2xl p-5 sm:p-6 min-w-0 ${className}`}>
      <h2 className="font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function PlatformDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(30);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/platform-stats', { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 404 ? 'Las estadísticas funcionan en la versión publicada (necesitan las funciones de Vercel).' : body.message || 'No se pudieron cargar las estadísticas.');
      setStats(body);
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Cifras del período elegido
  const period = useMemo(() => {
    if (!stats) return null;
    const days = stats.daily.slice(-range);
    const revenue = days.reduce((s, d) => s + d.revenue, 0);
    const orders = days.reduce((s, d) => s + d.orders, 0);
    return { days, revenue, orders, avg: orders ? revenue / orders : 0 };
  }, [stats, range]);

  if (isLoading && !stats) {
    return <div className="py-24 flex items-center justify-center gap-3 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Calculando estadísticas...</div>;
  }
  if (error) {
    return (
      <div className="py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/70 mx-auto mb-3" />
        <p className="text-sm text-zinc-300">{error}</p>
      </div>
    );
  }

  const k = stats.kpis;
  const rangeLabel = RANGES.find(r => r.days === range).label;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Resumen</h1>
          <p className="text-sm text-zinc-400 mt-1">Toda la plataforma: tiendas, ventas y clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1" role="group" aria-label="Período">
            {RANGES.map(r => (
              <button key={r.days} type="button" onClick={() => setRange(r.days)} aria-pressed={range === r.days}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${range === r.days ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label="Actualizar" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cifra principal + cifras del período */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <div className="bg-gradient-to-br from-indigo-600/20 to-black border border-indigo-500/20 rounded-2xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Facturación · últimos {rangeLabel}</p>
          <p className="mt-3 text-5xl font-black text-white">{formatMoney(period.revenue)}</p>
          <p className="mt-2 text-sm text-zinc-400">{count(period.orders)} ventas · ticket promedio {formatMoney(period.avg)}</p>
          <p className="mt-4 text-xs text-zinc-500">Histórico: {formatMoney(k.gmv)} en {count(k.paidOrders)} ventas</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="Tiendas" value={count(k.stores)} hint={`${k.sellingStores} vendiendo`} />
          <StatTile label="Piden activación" value={count(k.pendingActivation)} hint={k.pendingActivation ? 'Revisalas en Tiendas' : 'Al día'} />
          <StatTile label="Con MercadoPago" value={count(k.mpConnected)} hint="Cuentas conectadas" />
          <StatTile label="Usuarios" value={count(k.users)} hint={`${k.newUsers30d} nuevos en 30 días`} />
          <StatTile label="Productos activos" value={count(k.activeProducts)} hint="En todas las tiendas" />
          <StatTile label="Comisiones" value={formatMoney(k.estimatedFees)} hint="Estimadas, histórico" />
        </div>
      </div>

      {/* Ventas en el tiempo: dos gráficos, cada uno con su escala */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="Facturación por día" subtitle={`Pedidos pagados, últimos ${rangeLabel}`}>
          <TimeChart data={period.days} valueKey="revenue" format={shortMoney} label="Facturación" />
        </Card>
        <Card title="Ventas por día" subtitle={`Cantidad de pedidos pagados, últimos ${rangeLabel}`}>
          <TimeChart data={period.days} valueKey="orders" format={count} type="bars" label="Ventas" />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Tiendas que más venden" subtitle="Facturación histórica" className="xl:col-span-2">
          <RankedBars items={stats.byStore.filter(s => s.revenue > 0).slice(0, 8).map(s => ({ label: s.name, detail: `${s.paidOrders} ventas`, value: s.revenue }))} format={formatMoney} />
        </Card>
        <Card title="Pedidos que se pagan" subtitle="De los pedidos ya resueltos, cuántos se pagaron (el resto venció sin pago)">
          <Meter value={k.paymentConversion} label="Pedidos pagados sobre resueltos" />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Medios de pago" subtitle="Ventas pagadas">
          <SegmentedBar parts={stats.paymentMix.slice(0, 5)} format={count} />
        </Card>
        <Card title="Estado de los pedidos" subtitle="Todos los pedidos">
          <SegmentedBar parts={stats.statusMix} format={count} />
        </Card>
        <Card title="Tiendas por rubro">
          <RankedBars items={stats.templateMix.map(t => ({ label: templateLabel(t.label), value: t.value }))} format={count} color={VIZ.series[2]} />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="Crecimiento" subtitle="Altas por semana, últimas 12 semanas">
          <MultiLineChart data={stats.weekly} xKey="week" series={[
            { key: 'stores', label: 'Tiendas', color: VIZ.series[0] },
            { key: 'users', label: 'Cuentas', color: VIZ.series[1] }
          ]} label="Altas por semana" />
        </Card>
        <Card title="Productos más vendidos" subtitle="En todas las tiendas, por facturación">
          <RankedBars items={stats.topProducts.map(p => ({ label: p.name, detail: `${p.store} · ${p.units} u.`, value: p.revenue }))} format={formatMoney} color={VIZ.series[0]} />
        </Card>
      </div>

      {/* Detalle de cada tienda */}
      <Card title="Todas las tiendas" subtitle="Estado, dueño y ventas de cada una">
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500">
                {['Tienda', 'Dueño', 'Estado', 'Cobros', 'Productos', 'Ventas', 'Facturación', 'Última venta', 'Alta'].map((h, i) => (
                  <th key={h} className={`px-5 sm:px-6 py-2 font-bold ${i >= 4 && i <= 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.byStore.map(s => (
                <tr key={s.id} className="border-t border-white/5 text-zinc-300">
                  <td className="px-5 sm:px-6 py-3">
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-zinc-500">{templateLabel(s.template)} · {s.slug}</p>
                  </td>
                  <td className="px-5 sm:px-6 py-3 text-xs">{s.ownerEmail || <span className="text-zinc-600">Plataforma</span>}</td>
                  <td className="px-5 sm:px-6 py-3">
                    {s.status !== 'active' ? <Badge tone="red">Suspendida</Badge>
                      : s.activationRequested ? <Badge tone="amber">Pidió activación</Badge>
                      : s.salesEnabled ? <Badge tone="emerald">Vendiendo</Badge>
                      : <Badge tone="zinc">Sin ventas</Badge>}
                  </td>
                  <td className="px-5 sm:px-6 py-3 text-xs">{s.mpConnected ? 'MercadoPago' : <span className="text-zinc-500">Sin MP</span>}</td>
                  <td className="px-5 sm:px-6 py-3 text-right tabular-nums">{s.products}</td>
                  <td className="px-5 sm:px-6 py-3 text-right tabular-nums">{s.paidOrders}<span className="text-zinc-600"> / {s.orders}</span></td>
                  <td className="px-5 sm:px-6 py-3 text-right tabular-nums font-semibold text-white">{formatMoney(s.revenue)}</td>
                  <td className="px-5 sm:px-6 py-3 text-xs">{date(s.lastSale)}</td>
                  <td className="px-5 sm:px-6 py-3 text-xs">{date(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/plataforma/tiendas" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200">
          Administrar tiendas <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>

      <p className="text-xs text-zinc-600">
        Visitas, páginas vistas y de dónde llegan los clientes no se miden todavía: se pueden sumar activando la analítica de Vercel.
      </p>
    </div>
  );
}

function Badge({ tone, children }) {
  const tones = {
    red: 'bg-red-500/15 text-red-300',
    amber: 'bg-amber-500/20 text-amber-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    zinc: 'bg-white/10 text-zinc-300'
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}
