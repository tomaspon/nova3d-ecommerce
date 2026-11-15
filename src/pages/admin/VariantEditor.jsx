import { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';

// Talles / colores de un producto (supabase/011_talles.sql).
// Producto nuevo: se cargan los nombres y el stock inicial de cada uno.
// Producto existente: se agregan o quitan nombres; el stock de cada uno se cambia con
// "Ajustar stock" (así queda en el historial y nunca se pisa una venta).

const LABELS = ['Talle', 'Color', 'Talle / color'];
const QUICK_SETS = [
  { label: 'S a XL', names: ['S', 'M', 'L', 'XL'] },
  { label: 'XS a XXL', names: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Números 36 a 44', names: ['36', '38', '40', '42', '44'] },
  { label: 'Calzado 35 a 44', names: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'] }
];

const input = 'bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

/**
 * value: { enabled, label, rows: [{ name, stock }] }
 * existing: talles guardados del producto (con stock y reservado), o null si es nuevo
 */
export default function VariantEditor({ value, onChange, existing }) {
  const [draft, setDraft] = useState('');
  const isNew = !existing;
  const rows = value.rows || [];
  const set = (patch) => onChange({ ...value, ...patch });

  const add = (names) => {
    const current = new Set(rows.map(r => r.name.toLowerCase()));
    const fresh = names.map(n => n.trim()).filter(n => n && !current.has(n.toLowerCase()));
    if (fresh.length) set({ rows: [...rows, ...fresh.map(name => ({ name, stock: 0 }))] });
  };
  const addDraft = () => {
    // Acepta varios separados por coma: "S, M, L"
    add(draft.split(','));
    setDraft('');
  };
  const savedOf = (name) => existing?.find(v => v.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={value.enabled} onChange={e => set({ enabled: e.target.checked })} className="w-4 h-4 accent-indigo-500" />
        <span className="flex items-center gap-2 text-sm font-bold text-white"><Layers className="w-4 h-4 text-indigo-400" /> Tiene talles o colores</span>
      </label>

      {value.enabled && (
        <>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Cómo se llama la opción</span>
            <div className="flex flex-wrap gap-2">
              {LABELS.map(l => (
                <button key={l} type="button" onClick={() => set({ label: l })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${value.label === l ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Opciones</span>
            {rows.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_SETS.map(q => (
                  <button key={q.label} type="button" onClick={() => add(q.names)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300">
                    + {q.label}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-2">
              {rows.map((row, i) => {
                const saved = savedOf(row.name);
                return (
                  <li key={row.name} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white truncate">{row.name}</span>
                    {isNew ? (
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Stock
                        <input type="number" min="0" value={row.stock} aria-label={`Stock de ${row.name}`}
                          onChange={e => set({ rows: rows.map((r, j) => j === i ? { ...r, stock: Math.max(0, parseInt(e.target.value, 10) || 0) } : r) })}
                          className={`${input} w-20 font-mono`} />
                      </label>
                    ) : (
                      <span className="text-xs text-zinc-400 w-28 text-right">
                        {saved ? <>Stock <b className="text-white">{saved.stock}</b>{saved.reserved ? <> · {saved.reserved} res.</> : null}</> : <span className="text-indigo-300">Nuevo (stock 0)</span>}
                      </span>
                    )}
                    <button type="button" onClick={() => set({ rows: rows.filter((_, j) => j !== i) })} aria-label={`Quitar ${row.name}`} className="p-2 text-zinc-500 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2 mt-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
                placeholder={value.label === 'Color' ? 'Ej: Negro, Blanco' : 'Ej: S, M, L'} className={`${input} flex-1`} />
              <button type="button" onClick={addDraft} className="inline-flex items-center gap-1 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold">
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
            {!isNew && <p className="mt-2 text-[11px] text-zinc-500">El stock de cada opción se cambia con <b>Ajustar stock</b>, abajo: así queda en el historial.</p>}
          </div>
        </>
      )}
    </div>
  );
}
