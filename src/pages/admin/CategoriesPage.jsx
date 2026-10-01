import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Tag, Plus, Trash2, AlertTriangle } from 'lucide-react';

export default function CategoriesPage() {
  const { categories, addCategory, deleteCategory } = useStore();
  const [newCat, setNewCat] = useState('');
  
  // Hard Delete Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, categoryName: '', confirmText: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    if (newCat.trim()) {
      addCategory(newCat.trim());
      setNewCat('');
    }
  };

  const handleHardDelete = () => {
    if (deleteModal.confirmText !== 'ELIMINAR') return;
    deleteCategory(deleteModal.categoryName);
    setDeleteModal({ isOpen: false, categoryName: '', confirmText: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Categorías</h1>
          <p className="text-zinc-400 text-sm">Gestioná las colecciones de tu catálogo.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Formulario */}
        <div className="md:col-span-1">
          <form onSubmit={handleAdd} className="bg-black border border-white/10 rounded-2xl p-6 shadow-xl sticky top-8">
            <h2 className="text-lg font-bold text-white mb-4">Nueva Categoría</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nombre</label>
                <input 
                  type="text" 
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  placeholder="Ej. Accesorios"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Agregar
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Las categorías se usan para filtrar productos en la tienda.
            </p>
          </form>
        </div>

        {/* Lista de Categorías */}
        <div className="md:col-span-2">
          <div className="bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-400" />
                Categorías Existentes ({categories.length})
              </h2>
            </div>
            {categories.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
                <Tag className="w-12 h-12 opacity-20 mb-4" />
                No hay categorías creadas.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {categories.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="font-bold text-white">{cat}</span>
                    </div>
                    <button 
                      onClick={() => setDeleteModal({ isOpen: true, categoryName: cat, confirmText: '' })} 
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition" 
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* =========================================
          MODAL DE CONFIRMACIÓN HARD DELETE
          ========================================= */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-red-500/30 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-6 bg-red-500/10 flex flex-col items-center text-center border-b border-red-500/20">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Eliminar Categoría</h3>
              <p className="text-sm text-red-400 font-medium mb-1">Vas a eliminar la categoría "{deleteModal.categoryName}".</p>
              <p className="text-xs text-red-400/80">Los productos que tengan esta categoría no se borrarán, pero perderán esta etiqueta.</p>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-zinc-400 mb-4 text-center">Para confirmar, escribí la palabra <strong className="text-white">ELIMINAR</strong> abajo:</p>
              <input 
                type="text" 
                placeholder="ELIMINAR"
                value={deleteModal.confirmText}
                onChange={(e) => setDeleteModal({ ...deleteModal, confirmText: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 text-center font-bold tracking-widest mb-6" 
              />
              <div className="flex gap-4">
                <button onClick={() => setDeleteModal({ isOpen: false, categoryName: '', confirmText: '' })} className="flex-1 py-3 font-bold text-zinc-400 bg-white/5 hover:bg-white/10 rounded-xl transition">Cancelar</button>
                <button 
                  onClick={handleHardDelete}
                  disabled={deleteModal.confirmText !== 'ELIMINAR'}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white font-bold rounded-xl transition"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
