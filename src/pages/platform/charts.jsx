import { useEffect, useRef, useState } from 'react';

// Gráficos del panel de plataforma, en SVG y sin librerías. Siguen la guía de visualización:
// marcas finas (líneas de 2px, barras con punta redondeada de 4px), grilla discreta, un solo
// eje, leyenda cuando hay más de una serie, tooltip al pasar el mouse y tabla de datos.
// Paleta oscura validada contra el fondo del panel (#0a0a0a): todas las verificaciones pasan.

export const VIZ = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  ink: '#f0efec',
  ink2: '#c3c2b7',
  surface: '#0a0a0a'
};

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Escala "linda": 0 → un máximo redondo, con 3 marcas
function niceMax(max) {
  if (max <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find(s => s * exp * 2 >= max) * exp;
  return step * 2;
}

const shortDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Tooltip({ x, y, width, children }) {
  const left = Math.min(Math.max(x + 12, 0), width - 170);
  return (
    <div className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl" style={{ left, top: Math.max(y - 10, 0) }}>
      {children}
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 select-none">Ver datos</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
            <tr>{columns.map(c => <th key={c.label} className={`px-3 py-2 font-semibold ${c.numeric ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-white/5 text-zinc-300">
                {columns.map(c => <td key={c.label} className={`px-3 py-1.5 ${c.numeric ? 'text-right tabular-nums' : ''}`}>{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── Tarjeta de cifra ─────────────────────────────────────────────────────────
export function StatTile({ label, value, hint }) {
  return (
    <div className="bg-black border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl sm:text-[1.7rem] font-black text-white leading-none truncate">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-zinc-500 truncate">{hint}</p>}
    </div>
  );
}

// ── Serie de tiempo (área de una serie o columnas) ──────────────────────────
export function TimeChart({ data, valueKey, format, type = 'area', color = VIZ.series[0], height = 220, label }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 24, left: 56 };
  const innerW = Math.max(width - pad.left - pad.right, 0);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map(d => d[valueKey]), 0));
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const step = data.length > 1 ? innerW / (data.length - (type === 'bars' ? 0 : 1)) : innerW;
  const x = (i) => pad.left + (type === 'bars' ? step * i + step / 2 : step * i);
  const ticks = [0, max / 2, max];
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    const i = Math.round(type === 'bars' ? (px - step / 2) / step : px / step);
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };

  const linePath = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[valueKey])}`).join('');
  const barW = Math.max(Math.min(step - 2, 28), 1);
  const point = hover !== null ? data[hover] : null;

  return (
    <div>
      <div ref={ref} className="relative" style={{ height }} role="img" aria-label={label}>
        {width > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
            {ticks.map(t => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth="1" />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={VIZ.muted}>{format(t, true)}</text>
              </g>
            ))}
            {labelIdx.map(i => data[i] && (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill={VIZ.muted}>{shortDate(data[i].date)}</text>
            ))}
            {type === 'bars' ? data.map((d, i) => {
              const h = Math.max(innerH - (y(d[valueKey]) - pad.top), 0);
              if (h <= 0) return null;
              const r = Math.min(4, barW / 2, h);
              const bx = x(i) - barW / 2, by = y(d[valueKey]);
              return (
                <path key={d.date} fill={color} opacity={hover === null || hover === i ? 1 : 0.45}
                  d={`M${bx},${by + h} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + barW - r},${by} Q${bx + barW},${by} ${bx + barW},${by + r} L${bx + barW},${by + h} Z`} />
              );
            }) : (
              <>
                <path d={`${linePath}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={color} opacity="0.14" />
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {point && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={VIZ.ink2} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                {type !== 'bars' && <circle cx={x(hover)} cy={y(point[valueKey])} r="4.5" fill={color} stroke={VIZ.surface} strokeWidth="2" />}
              </g>
            )}
          </svg>
        )}
        {point && (
          <Tooltip x={x(hover)} y={y(point[valueKey]) - 40} width={width}>
            <p className="text-zinc-400">{shortDate(point.date)}</p>
            <p className="mt-0.5 font-bold text-white">{format(point[valueKey])}</p>
          </Tooltip>
        )}
      </div>
      <DataTable
        columns={[{ label: 'Día', render: r => shortDate(r.date) }, { label, numeric: true, render: r => format(r[valueKey]) }]}
        rows={[...data].reverse()}
      />
    </div>
  );
}

// ── Varias series en el tiempo (misma escala) ───────────────────────────────
export function MultiLineChart({ data, xKey, series, height = 200, label }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 64, bottom: 24, left: 36 };
  const innerW = Math.max(width - pad.left - pad.right, 0);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.flatMap(d => series.map(s => d[s.key])), 0));
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const x = (i) => pad.left + step * i;
  const ticks = [0, max / 2, max];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(Math.max(Math.round((e.clientX - rect.left - pad.left) / step), 0), data.length - 1));
  };
  const last = data.length - 1;

  // Etiquetas al final de cada línea, separadas al menos 13px para que no se pisen
  const endLabels = series
    .map(s => ({ key: s.key, label: s.label, y: y(data[last]?.[s.key] || 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < 13) endLabels[i].y = endLabels[i - 1].y + 13;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        {series.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
            <span className="w-3 h-0.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative" style={{ height }} role="img" aria-label={label}>
        {width > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
            {ticks.map(t => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={VIZ.muted}>{t}</text>
              </g>
            ))}
            {[0, Math.floor(last / 2), last].map(i => data[i] && (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="10" fill={VIZ.muted}>{shortDate(data[i][xKey])}</text>
            ))}
            {series.map(s => (
              <g key={s.key}>
                <path d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[s.key])}`).join('')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}
            {endLabels.map(l => (
              <text key={l.key} x={x(last) + 8} y={l.y} dy="0.32em" fontSize="11" fill={VIZ.ink2}>{l.label}</text>
            ))}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={VIZ.ink2} strokeDasharray="3 3" opacity="0.6" />
                {series.map(s => <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="4.5" fill={s.color} stroke={VIZ.surface} strokeWidth="2" />)}
              </g>
            )}
          </svg>
        )}
        {hover !== null && (
          <Tooltip x={x(hover)} y={pad.top} width={width}>
            <p className="text-zinc-400">Semana del {shortDate(data[hover][xKey])}</p>
            {series.map(s => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-white">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.label}: <b>{data[hover][s.key]}</b>
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      <DataTable
        columns={[{ label: 'Semana', render: r => shortDate(r[xKey]) }, ...series.map(s => ({ label: s.label, numeric: true, render: r => r[s.key] }))]}
        rows={[...data].reverse()}
      />
    </div>
  );
}

// ── Barras horizontales ordenadas (comparar partes o tiendas) ───────────────
export function RankedBars({ items, format = (v) => v, color = VIZ.series[0], empty = 'Sin datos todavía.' }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-zinc-500">{empty}</p>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map(item => (
        <li key={item.label} title={`${item.label}: ${format(item.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-zinc-200 truncate">{item.label}{item.detail && <span className="text-zinc-500"> · {item.detail}</span>}</span>
            <span className="text-white font-semibold tabular-nums shrink-0">{format(item.value)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/[0.04]">
            <div className="h-2 rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Una totalidad partida en partes (≤ 6) ────────────────────────────────────
export function SegmentedBar({ parts, format = (v) => v, empty = 'Sin datos todavía.' }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return <p className="py-8 text-center text-sm text-zinc-500">{empty}</p>;
  return (
    <div>
      <div className="flex h-10 w-full gap-[2px] overflow-hidden rounded-lg">
        {parts.map((p, i) => {
          const share = p.value / total;
          return (
            <div key={p.label} title={`${p.label}: ${format(p.value)} (${Math.round(share * 100)}%)`}
              className="flex items-center justify-center text-xs font-bold first:rounded-l-lg last:rounded-r-lg"
              style={{ width: `${share * 100}%`, background: VIZ.series[i], color: i === 3 ? '#0b0b0b' : '#ffffff' }}>
              {share >= 0.12 && `${Math.round(share * 100)}%`}
            </div>
          );
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: VIZ.series[i] }} />
            <span className="text-zinc-300 flex-1 truncate">{p.label}</span>
            <span className="text-white font-semibold tabular-nums">{format(p.value)}</span>
            <span className="w-10 text-right text-zinc-500 tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Una proporción contra su total ──────────────────────────────────────────
export function Meter({ value, label }) {
  if (value === null || value === undefined) return <p className="text-sm text-zinc-500">Sin pedidos resueltos todavía.</p>;
  const pct = Math.round(value * 100);
  return (
    <div>
      <p className="text-4xl font-black text-white">{pct}%</p>
      <div className="mt-3 h-2.5 rounded-full bg-white/[0.06]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: VIZ.series[0] }} />
      </div>
    </div>
  );
}
