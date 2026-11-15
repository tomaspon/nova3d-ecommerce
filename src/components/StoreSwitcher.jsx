import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useStore } from '../context/StoreContext';
import { panelPath, panelSectionFromPath } from '../sitePaths';

// Quien maneja más de una tienda la elige acá: lleva a la misma sección del panel de la otra
// tienda (/panel/<tienda>/<sección>), con recarga completa para cargar sus datos.
export default function StoreSwitcher({ className = '' }) {
  const { store } = useStore();
  const [stores, setStores] = useState([]);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('my_stores').then(({ data }) => {
      // Solo las tiendas propias (el superadmin entra a las demás desde su panel)
      if (!cancelled && Array.isArray(data)) setStores(data.filter(s => s.role !== 'platform'));
    });
    return () => { cancelled = true; };
  }, []);

  if (!store) return null;
  if (stores.length < 2 || !stores.some(s => s.slug === store.slug)) {
    return <span className={`block text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate ${className}`}>/{store.slug}</span>;
  }

  const handleChange = (e) => {
    const slug = e.target.value;
    if (slug && slug !== store.slug) window.location.assign(panelPath(slug, panelSectionFromPath(window.location.pathname)));
  };

  return (
    <label className={`block ${className}`}>
      <span className="sr-only">Tienda que estás administrando</span>
      <select
        value={store.slug}
        onChange={handleChange}
        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-200 focus:outline-none focus:border-indigo-500"
      >
        {stores.map(s => <option key={s.id} value={s.slug}>{s.name} · /{s.slug}</option>)}
      </select>
    </label>
  );
}
