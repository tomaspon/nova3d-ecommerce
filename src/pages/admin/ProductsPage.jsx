import React, { useState, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Plus, Search, Tag, EyeOff, Edit2, ArchiveRestore, Image as ImageIcon, Upload } from 'lucide-react';

export default function ProductsPage() {
  const { products, categories, addProduct, softDeleteProduct, restoreProduct, addCategory, updateProduct } = useStore();
  
  // Estados para búsqueda y filtrado
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showInactive, setShowInactive] = useState(false);

  // Estados para el Modal de Crear/Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    discount: 0,
    category: '',
    newCategory: '',
    stock: 0,
    imageUrl: null
  });

  // Filtrado de productos robusto
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    const matchesActiveStatus = showInactive ? !p.isActive : p.isActive;
    
    return matchesSearch && matchesCategory && matchesActiveStatus;
  });

  // Handlers del Formulario
  const openModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price,
        discount: product.discount,
        category: product.category,
        newCategory: '',
        stock: product.stock,
        imageUrl: product.imageUrl || null
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', price: '', discount: 0, category: categories[0] || '', newCategory: '', stock: 0, imageUrl: null });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convertir la imagen a Base64 para guardarla en LocalStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalCategory = formData.category;
    
    // Creación de categoría "On the fly"
    if (formData.newCategory.trim() !== '') {
      addCategory(formData.newCategory.trim());
      finalCategory = formData.newCategory.trim();
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      price: Number(formData.price),
      discount: Number(formData.discount),
      category: finalCategory,
      stock: Number(formData.stock),
      imageUrl: formData.imageUrl
    };

    if (editingId) {
      updateProduct(editingId, payload);
    } else {
      addProduct(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* ── HEADER Y ACCIONES ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Catálogo de Productos</h1>
          <p className="text-zinc-400 text-sm">Gestioná precios, stock, ofertas e imágenes de tu inventario.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-5 h-5" /> Nuevo Producto
        </button>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por ID (ej. PROD-1001) o Nombre..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="All">Todas las categorías</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          <button 
            onClick={() => setShowInactive(!showInactive)}
            className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${showInactive ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-transparent text-zinc-500 border-white/10 hover:bg-white/5'}`}
          >
            {showInactive ? 'Viendo Ocultos' : 'Ver Ocultos'}
          </button>
        </div>
      </div>

      {/* ── TABLA DE PRODUCTOS ── */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-white/5 text-zinc-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">
                    No se encontraron productos con estos filtros.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${!p.isActive ? 'opacity-40 grayscale' : ''}`}>
                    <td className="px-6 py-4 flex items-center gap-4">
                      {/* Miniatura de la imagen */}
                      <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-zinc-700" />
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-xs text-indigo-400 mb-0.5">{p.id}</div>
                        <div className="font-bold text-white">{p.name}</div>
                        {p.discount > 0 && (
                          <span className="inline-flex mt-1 items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Tag className="w-3 h-3" /> {p.discount}% OFF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium">
                      ${p.price}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.stock > 5 ? 'bg-zinc-800 text-zinc-300' : p.stock > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {p.stock} uni.
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-white/10 text-zinc-300 text-xs px-2 py-1 rounded">{p.category}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.isActive ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(p)} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition border border-transparent hover:border-white/10" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => softDeleteProduct(p.id)} className="p-2 text-red-400/70 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition border border-transparent hover:border-red-500/20" title="Ocultar (Borrado Lógico)">
                            <EyeOff className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => restoreProduct(p.id)} className="px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition flex items-center gap-2 ml-auto">
                          <ArchiveRestore className="w-4 h-4" /> Restaurar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE CREACIÓN / EDICIÓN ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-white/10 bg-zinc-900/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              <div className="grid md:grid-cols-3 gap-8">
                
                {/* Columna Izquierda: Subida de Imagen */}
                <div className="md:col-span-1 space-y-4">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Imagen Principal</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full aspect-[4/5] rounded-xl border-2 border-dashed ${formData.imageUrl ? 'border-indigo-500/30' : 'border-white/10 hover:border-indigo-500/50'} flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition group bg-black/50`}
                  >
                    {formData.imageUrl ? (
                      <>
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-50 transition" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md">Cambiar Foto</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3 group-hover:text-indigo-400 transition" />
                        <span className="text-sm font-bold text-zinc-400 group-hover:text-indigo-300">Subir Imagen</span>
                        <p className="text-[10px] text-zinc-600 mt-2">JPG, PNG o WEBP</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Columnas Derecha: Datos */}
                <div className="md:col-span-2 grid md:grid-cols-2 gap-6 content-start">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nombre del Producto</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Precio ($)</label>
                    <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Oferta (% OFF)</label>
                    <input type="number" min="0" max="100" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-emerald-400 focus:outline-none focus:border-emerald-500 transition" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Categoría Existente</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition appearance-none">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">O Crear Nueva Categoría</label>
                    <input type="text" placeholder="Ej. Accesorios" value={formData.newCategory} onChange={e => setFormData({...formData, newCategory: e.target.value})} className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-indigo-300 focus:outline-none focus:border-indigo-500 transition" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stock Inicial</label>
                    <input required type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Descripción Larga</label>
                    <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none transition"></textarea>
                  </div>
                </div>

              </div>

              <div className="pt-8 mt-6 border-t border-white/10 flex justify-end gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-zinc-400 hover:text-white transition">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-500/20">
                  {editingId ? 'Guardar Cambios' : 'Publicar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
