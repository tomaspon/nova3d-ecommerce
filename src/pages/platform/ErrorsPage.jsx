import { useCallback, useEffect, useState } from 'react';
import { Bug, RefreshCw, Monitor, Server, Store } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Superadmin › Errores: lo que falló en el navegador de los visitantes y en el servidor
// (cobros, mails, altas...). Los repetidos se agrupan. Se guardan 30 días (supabase/016).

const RANGES = [[1, 'Hoy'], [7, '7 días'], [30, '30 días']];

function ago(at) {
  const s = Math.max(0, Math.round((Date.now() - new Date(at)) / 1000));
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export default function ErrorsPage() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc('recent_errors', { p_days: days });
    if (rpcError) {
      setError(/recent_errors|function|schema cache/i.test(rpcError.message || '')
        ? 'Para ver los errores, corré supabase/016_privacidad_y_errores.sql en Supabase.'
        : 'No se pudieron cargar los errores.');
      setRows([]);
    } else {
      setError('');
      setRows(data || []);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const total = (rows || []).reduce((sum, r) => sum + (r.times || 1), 0);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3"><Bug className="w-7 h-7 text-red-400" /> Errores</h1>
          <p className="text-sm text-zinc-400 mt-1">Lo que falló en las tiendas y en el servidor. Los repetidos se agrupan.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/5 p-1" role="group" aria-label="Período">
            {RANGES.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDays(value)} aria-pressed={days === value}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${days === value ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={load} disabled={loading} aria-label="Actualizar" className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-white/10 bg-black p-5 text-sm text-zinc-400">{error}</p>
      ) : rows === null ? null : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black p-10 text-center">
          <p className="text-white font-bold">Sin errores en este período</p>
          <p className="text-sm text-zinc-500 mt-1">Todo anduvo bien.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-400">{rows.length} distintos · {total.toLocaleString('es-AR')} en total</p>
          <ul className="space-y-2">
            {rows.map(r => {
              const server = r.source !== 'navegador';
              return (
                <li key={r.id} className="rounded-xl border border-white/10 bg-black">
                  <details>
                    <summary className="cursor-pointer list-none p-4 flex items-start gap-3">
                      {server ? <Server className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" aria-label="Servidor" /> : <Monitor className="w-4 h-4 mt-0.5 text-sky-300 shrink-0" aria-label="Navegador" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-semibold break-words">{r.message}</p>
                        <p className="mt-1 text-xs text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>{server ? r.source : 'Navegador'}</span>
                          {r.store && <span className="inline-flex items-center gap-1"><Store className="w-3 h-3" /> {r.store}</span>}
                          {r.path && <span className="font-mono truncate max-w-[16rem]">{r.path}</span>}
                          <span>{ago(r.last_at)}</span>
                        </p>
                      </div>
                      {r.times > 1 && <span className="shrink-0 rounded-full bg-red-500/15 text-red-300 text-xs font-bold px-2 py-0.5 tabular-nums">×{r.times}</span>}
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {r.detail && <pre className="text-[11px] leading-relaxed text-zinc-400 bg-white/[0.03] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{r.detail}</pre>}
                      <p className="text-[11px] text-zinc-600">Primera vez: {new Date(r.created_at).toLocaleString('es-AR')}{r.user_agent ? ` · ${r.user_agent}` : ''}</p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
