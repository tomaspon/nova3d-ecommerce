import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Store, ArrowRight, Plus, LogOut } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { PLATFORM_BRAND } from '../../platformBrand';
import { panelPath } from '../../sitePaths';

// /panel: las tiendas de la cuenta. Con una sola, entra directo a su panel.
// Se navega con recarga completa: cada panel carga su tienda desde la dirección.
export default function PanelHome() {
  const [stores, setStores] = useState(null);

  useEffect(() => {
    document.title = `Mis tiendas | ${PLATFORM_BRAND.name}`;
    supabase.rpc('my_stores').then(({ data }) => {
      const list = (data || []).filter(s => s.role !== 'platform');
      if (list.length === 1) window.location.replace(panelPath(list[0].slug));
      else setStores(list);
    });
  }, []);

  if (!stores) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-black text-white tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-400">.</span></span>
          <button type="button" onClick={async () => { await supabase.auth.signOut(); window.location.assign('/panel'); }} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-black text-white tracking-tight">Mis tiendas</h1>
        {stores.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <Store className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="mt-3 text-white font-bold">Todavía no tenés ninguna tienda</p>
            <p className="mt-1 text-sm text-zinc-500">Creala en 2 minutos, gratis.</p>
            <Link to="/crear" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 text-sm">
              <Plus className="w-4 h-4" /> Crear mi tienda
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {stores.map(s => (
              <li key={s.id}>
                <a href={panelPath(s.slug)} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] p-4 transition">
                  <span className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center font-black">{(s.name || '?').charAt(0)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-white truncate">{s.name}</span>
                    <span className="block text-xs text-zinc-500">/{s.slug}{s.status !== 'active' ? ' · suspendida' : ''}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
