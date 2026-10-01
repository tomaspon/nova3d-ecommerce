import { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Plus, Tag, Trash2 } from 'lucide-react';

export default function CategoriesPage() {
  const { categories, products, addCategory, deleteCategory } = useStore();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);

  const trimmedName = newName.trim();
  const alreadyExists = categories.some(cat => cat.toLowerCase() === trimmedName.toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (trimmedName === '' || alreadyExists) return;
    setError(null);
    try {
      await addCategory(trimmedName);
      setNewName('');
    } catch (err) {
      setError(`No se pudo crear la categoría: ${err.message}`);
    }
  };

  const handleDelete = async (name) => {
    setError(null);
    try {
      await deleteCategory(name);
    } catch (err) {
      setError(`No se pudo eliminar la categoría: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Categorías</h1>
        <p className="text-zinc-400 text-sm">Organizá tu catálogo. Solo se pueden eliminar las categorías sin productos.</p>
      </div>

      {/* ── NUEVA CATEGORÍA ── */}
      <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-3 md:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Nombre de la nueva categoría..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 md:py-2 text-base md:text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={trimmedName === '' || alreadyExists}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" /> Agregar
          </button>
        </div>
        {alreadyExists && (
          <p className="text-xs text-yellow-400 mt-2 px-1">Ya existe una categoría con ese nombre.</p>
        )}
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* ── LISTA DE CATEGORÍAS ── */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl divide-y divide-white/5">
        {categories.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Todavía no hay categorías.
          </div>
        ) : (
          categories.map(cat => {
            const count = products.filter(p => p.category === cat).length;
            return (
              <div key={cat} className="flex items-center gap-3 px-4 md:px-6 py-3.5">
                <div className="w-9 h-9 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{cat}</div>
                  <div className="text-xs text-zinc-500">{count} {count === 1 ? 'producto' : 'productos'}</div>
                </div>
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={count > 0}
                  aria-label={`Eliminar ${cat}`}
                  title={count > 0 ? 'Tiene productos asignados' : 'Eliminar categoría'}
                  className="p-3 md:p-2 text-red-400/70 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
