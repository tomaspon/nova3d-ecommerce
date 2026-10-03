import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { Plus, Trash2, Power, PowerOff, Image as ImageIcon, ArchiveRestore, Upload, Loader2, Search, Download, AlertTriangle, Minus, X, Activity, ScanBarcode, ChevronDown } from 'lucide-react';
import { fetchReservedMap } from '../../reservations';
import { mapProduct } from '../../productMapping';

// El lector de códigos pesa ~400 kB: se descarga recién al abrirlo
const BarcodeScanner = lazy(() => import('../../components/BarcodeScanner'));

export default function ProductsPage() {
  const { addProduct, updateProduct, categories } = useStore();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFetchingBarcode, setIsFetchingBarcode] = useState(false);
  const [filterTab, setFilterTab] = useState('inStock');
  const [selectedCategory, setSelectedCategory] = useState('all'); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productLogs, setProductLogs] = useState([]);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', discount: '0', stock: 0,
    category: '', newCategory: '', imageUrl: '', images: []
  });

    const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ type: 'inc', qty: '', reason: 'Ingreso', note: '' });

  const addFeatureRow = () => {
    setFormData(prev => ({
      ...prev,
      features: [...(prev.features || []), { key: '', value: '' }]
    }));
  };

  const updateFeature = (index, field, value) => {
    const updated = [...formData.features];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, features: updated }));
  };

  const removeFeature = (index) => {
    const updated = formData.features.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, features: updated }));
  };

  const handleAdjustTypeChange = (newType) => {
    setAdjustForm(prev => ({
      ...prev,
      type: newType,
      reason: newType === 'inc' ? 'Ingreso' : 'Dañado'
    }));
  };

  const handleQuickAdjustment = async () => {
    if (!editingId) return;
    const qty = parseInt(adjustForm.qty);
    if (!qty || qty <= 0) return;

    try {
      // La base aplica el ajuste sobre el stock que hay en ese instante (no el que mostraba el
      // formulario) y registra el movimiento, todo en una sola operación.
      const { data: newStock, error } = await supabase.rpc('adjust_stock', {
        p_product_id: editingId,
        p_delta: adjustForm.type === 'inc' ? qty : -qty,
        p_reason: adjustForm.reason,
        p_note: adjustForm.note
      });
      if (error) throw error;

      setFormData(prev => ({ ...prev, stock: newStock }));
      setAdjustForm({ type: 'inc', qty: '', reason: 'Ingreso', note: '' });
      setShowAdjustForm(false);
      
      const { data } = await supabase.from('inventory_logs').select('*').eq('product_id', editingId).order('created_at', { ascending: false });
      setProductLogs(data || []);
      
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error aplicando ajuste');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Mismas reglas de reserva que usa la tienda (reservations.js)
      const [prodRes, reservedMap] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        fetchReservedMap()
      ]);
      if (prodRes.error) throw prodRes.error;

      setProducts(prodRes.data.map(row => {
        const product = mapProduct(row, reservedMap);
        return { ...product, image_url: product.imageUrl };
      }));
    } catch (error) {
      console.error('Error cargando inventario:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      setIsUploading(true);
      const newImages = [];
      
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
        newImages.push(publicUrl);
      }

      setFormData(prev => ({ 
        ...prev, 
        images: [...(prev.images || []), ...newImages] 
      }));
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error subiendo imágenes.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const openModal = async (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name, description: product.description || '', price: product.price,
        discount: product.discount || '0', stock: Number(product.stock), category: product.category || '',
        newCategory: '', imageUrl: product.imageUrl || '', images: product.images?.length > 0 ? product.images : (product.imageUrl ? [product.imageUrl] : []),
          barcode: product.barcode || '',
        
      });
      // Fetch history for this product
      const { data } = await supabase.from('inventory_logs').select('*').eq('product_id', product.id).order('created_at', { ascending: false });
      setProductLogs(data || []);
    } else {
      setEditingId(null);
      setFormData({
        name: '', description: '', price: '', discount: '0', stock: 0, adjustmentAmount: 0,
        category: categories[0] || '', newCategory: '', imageUrl: '', images: [],
          barcode: '',
        
      });
      setProductLogs([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalCategory = formData.newCategory.trim() ? formData.newCategory.trim() : formData.category;
    
    

    // El stock no viaja en la edición: se maneja con los ajustes de inventario
    const payload = {
      name: formData.name, description: formData.description, price: Number(formData.price),
      discount: Number(formData.discount), stock: 0, category: finalCategory,
      imageUrl: formData.images?.[0] || null, images: formData.images,
      features: formData.features, barcode: formData.barcode
    };

    const result = editingId ? await updateProduct(editingId, payload) : await addProduct(payload);
    if (!result.success) {
      // El formulario queda abierto para no perder lo cargado
      alert(`No se pudo guardar el producto: ${result.error}`);
      return;
    }

    setIsModalOpen(false);
    fetchData();
  };

  const toggleStatus = async (currentStatus) => {
    if (!editingId) return;
    const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', editingId);
    if (error) {
      alert(`No se pudo cambiar el estado de la publicación: ${error.message}`);
      return;
    }
    fetchData();
    setIsModalOpen(false);
  };

  const handleHardDelete = async () => {
    if (!editingId) return;
    const confirmStr = window.prompt("Para eliminar permanentemente este producto, escribe la palabra ELIMINAR en mayúsculas:");
    if (confirmStr === 'ELIMINAR') {
      const { error } = await supabase.from('products').delete().eq('id', editingId);
      if (error) {
        alert(`No se pudo eliminar el producto: ${error.message}`);
        return;
      }
      setIsModalOpen(false);
      fetchData();
    }
  };

    const handleExportJSON = () => {
    const dataStr = JSON.stringify(products, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_productos_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProductLogsCSV = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const headers = ['Fecha de Mov.', 'Motivo', 'Cantidad', 'On Hand'];
    const rows = productLogs.map(log => {
      const date = new Date(log.created_at).toLocaleString('es-AR');
      const reason = `"${(log.reason || '').replace(/"/g, '""')} ${log.note ? '- ' + log.note.replace(/"/g, '""') : ''}"`;
      const cant = log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount;
      const onHand = log.stock_after ?? '-';
      return [date, reason, cant, onHand].join(',');
    });
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historial_${formData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nombre', 'Categoría', 'Precio', 'Descuento (%)', 'Stock', 'Estado'];
    const rows = products.map(p => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price,
      p.discount || 0,
      p.stock,
      p.is_active ? 'Activo' : 'Pausado'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_minimal_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLogsCSV = async () => {
    try {
      const { data: logs, error } = await supabase.from('inventory_logs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!logs || logs.length === 0) {
        alert('No hay movimientos registrados.');
        return;
      }

      const headers = ['Fecha', 'Hora', 'ID Producto', 'Producto', 'Ajuste', 'Stock Final', 'Motivo', 'Nota'];
      
      const rows = logs.map(log => {
        const product = products.find(p => p.id === log.product_id);
        const productName = product ? product.name : 'Producto Eliminado';
        const dateObj = new Date(log.created_at);
        
        return [
          dateObj.toLocaleDateString('es-AR'),
          dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          log.product_id.split('-')[0],
          `"${productName.replace(/"/g, '""')}"`,
          log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount,
          log.stock_after ?? '-',
          `"${(log.reason || '').replace(/"/g, '""')}"`,
          `"${(log.note || '').replace(/"/g, '""')}"`
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historial_movimientos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Error al exportar historial.');
    }
  };


  let filteredProducts = products;
  if (filterTab === 'inStock') filteredProducts = products.filter(p => p.stock > 0);
  if (filterTab === 'soldOut') filteredProducts = products.filter(p => p.stock <= 0);
  if (filterTab === 'discount') filteredProducts = products.filter(p => p.discount > 0);
  if (filterTab === 'active') filteredProducts = products.filter(p => p.is_active);
  if (filterTab === 'inactive') filteredProducts = products.filter(p => !p.is_active);
  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.includes(searchQuery));
  }

  // Encontrar estado del producto editado
  const editingProductData = editingId ? products.find(p => p.id === editingId) : null;

  
  if (selectedCategory !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
  }
  
  // Ordenar alfabéticamente por nombre
  filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER Y ACCIONES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Inventario</h1>
          <p className="text-zinc-400 text-sm">Gestiona tus productos y controla el stock.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-sm">
            <button onClick={handleExportCSV} className="px-4 py-2 text-white text-sm font-bold hover:bg-white/10 transition flex items-center gap-2 border-r border-white/10" title="Exportar a Excel (.csv)">
              <Download className="w-4 h-4" /> CSV (Excel)
            </button>
            <button onClick={handleExportJSON} className="px-4 py-2 text-zinc-400 text-sm font-bold hover:bg-white/10 hover:text-white transition" title="Exportar crudo (.json)">
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-black border border-white/5 p-4 rounded-2xl">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar px-1 pb-2 md:pb-0 snap-x">
          <button onClick={() => setFilterTab('all')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>Todos</button>
          <button onClick={() => setFilterTab('inStock')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'inStock' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>En Stock</button>
          <button onClick={() => setFilterTab('soldOut')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'soldOut' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>Agotados</button>
          <button onClick={() => setFilterTab('discount')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'discount' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>En Oferta</button>
            <button onClick={() => setFilterTab('active')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'active' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>Activos</button>
            <button onClick={() => setFilterTab('inactive')} className={`shrink-0 snap-center px-4 py-2 rounded-xl whitespace-nowrap font-bold text-sm transition ${filterTab === 'inactive' ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>Pausados</button>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar producto..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-transparent focus:border-indigo-500/50 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
          />
        </div>
      </div>

      {/* DATA GRID */}
      <div className="p-4 border border-white/5 rounded-2xl bg-black">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          {/* SIDEBAR DE CATEGORÍAS */}
          <div className="w-full lg:w-48 shrink-0 sticky top-6 flex flex-col">
             <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 opacity-50 px-4 pt-1">Categorías</h3>
             <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto hide-scrollbar pb-2 lg:pb-0 px-1">
               <button type="button" onClick={() => setSelectedCategory('all')} className={`px-4 py-2.5 text-left text-sm font-bold shrink-0 rounded-xl transition-colors whitespace-nowrap ${selectedCategory === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>Todas</button>
               {uniqueCategories.map(cat => (
                 <button type="button" key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2.5 text-left text-sm font-bold shrink-0 rounded-xl transition-colors whitespace-nowrap truncate ${selectedCategory === cat ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title={cat}>{cat}</button>
               ))}
             </div>
          </div>
          
          <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            
            {/* BOTÓN CREAR NUEVO (Tarjeta 1) */}
            <div 
              onClick={() => openModal()} 
              className="aspect-[4/5] bg-zinc-900 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer group transition-colors shadow-sm"
            >
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-indigo-400" />
              </div>
              <span className="text-sm font-bold text-zinc-400 group-hover:text-indigo-300">Nuevo Producto</span>
            </div>

            {/* PRODUCTOS */}
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                onClick={() => openModal(product)}
                className="group cursor-pointer relative bg-zinc-950 rounded-2xl border border-white/5 shadow-sm hover:border-indigo-500/30 transition-all hover:shadow-lg overflow-hidden flex flex-col"
              >
                {/* Imagen */}
                <div className="aspect-square relative overflow-hidden bg-zinc-900/50 border-b border-white/5">
                  <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
                    {product.stock <= 0 ? (
                      <div className="bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase backdrop-blur-md">
                        Agotado
                      </div>
                    ) : (
                      <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase backdrop-blur-md">
                        Stock: {product.stock}
                      </div>
                    )}
                    {!product.is_active && (
                      <div className="bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase backdrop-blur-md">
                        Inactivo
                      </div>
                    )}
                  </div>

                  {product.image_url ? (
                    <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-700 ease-out mix-blend-lighten" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                </div>
                
                {/* Info Text */}
                <div className="p-3 flex-1 flex flex-col justify-end">
                  <h3 className="font-bold text-white text-sm truncate">{product.name}</h3>
                  <div className="text-xs text-zinc-400 mt-1">${Number(product.price).toLocaleString('es-AR')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* MODAL PRINCIPAL (Detalle & Edición & Historial) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 bg-zinc-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-20">
              <div>
                <h2 className="text-2xl font-black text-white">{editingId ? 'Detalle del Producto' : 'Crear Nuevo Producto'}</h2>
                <p className="text-sm text-zinc-400">{editingId ? 'Modifica la Información, ajusta el stock o revisa su historial.' : 'Completa los datos para publicar en el catálogo.'}</p>
              </div>
              
              <div className="flex items-center gap-2">
                {editingId && editingProductData && (
                  <>
                    <button type="button" onClick={() => toggleStatus(editingProductData.is_active)} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-2 ${editingProductData.is_active ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                      {editingProductData.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      {editingProductData.is_active ? 'Pausar Publicación' : 'Activar Publicación'}
                    </button>
                    <button type="button" onClick={handleHardDelete} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition" title="Eliminar Producto">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 bg-black/50 hover:bg-black rounded-xl text-zinc-400 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto custom-scrollbar flex-1">
              <form id="product-form" onSubmit={handleSubmit} className="p-4">
                
                {/* 2 Column Layout para Datos Principales */}
                <div className="grid md:grid-cols-3 gap-8">
                  
                  {/* IMAGEN UPLOADER MULTIPLE */}
                    <div className="md:col-span-1 space-y-3">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Fotos del Producto</label>
                      
                      <div className={`grid ${formData.images?.length > 0 ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
                        {formData.images?.map((url, idx) => (
                          <div key={idx} className="relative aspect-square bg-black border border-white/10 rounded-xl overflow-hidden group">
                            <img loading="lazy" decoding="async" src={url} alt={`Preview ${idx}`} className="w-full h-full object-contain p-1" />
                            <button 
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        
                        <div 
                          onClick={() => !isUploading && fileInputRef.current?.click()}
                          className={`${formData.images?.length > 0 ? 'aspect-square' : 'aspect-square w-full'} bg-black border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition group`}
                        >
                          {isUploading ? (
                            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-6 h-6 text-zinc-600 group-hover:text-indigo-400 transition mb-2" />
                              {(!formData.images || formData.images.length === 0) && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Agregar Fotos</span>}
                            </>
                          )}
                        </div>
                      </div>
                      <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                      <p className="text-[10px] text-zinc-500 text-center">Podes subir multiples imagenes.</p>
                    </div>

                  {/* FORMULARIO DATOS */}
                  <div className="md:col-span-2 space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nombre del Producto</label>
                      <input required type="text" placeholder="Ej. Remera Oversize" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition text-sm font-bold" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Precio Base ($)</label>
                        <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition font-mono text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Descuento (%)</label>
                        <input type="number" min="0" max="100" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-emerald-400 focus:outline-none focus:border-emerald-500 transition font-mono text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Categoría</label>
                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition appearance-none text-sm">
                          <option value="">Seleccionar...</option>
                          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">O Crear Nueva</label>
                        <input type="text" placeholder="Ej. Accesorios" value={formData.newCategory} onChange={e => setFormData({...formData, newCategory: e.target.value})} className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-lg px-4 py-2.5 text-indigo-300 focus:outline-none focus:border-indigo-500 transition text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">DESCRIPCIÓN</label>
                      <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none transition custom-scrollbar text-sm"></textarea>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5 my-4"></div>

                {/* GESTIÓN DE INVENTARIO Y TABLA */}
                  <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col">
                    {editingId ? (
                      <>
                        <div className="flex gap-3 mb-6">
                            <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 flex items-center justify-between">
                              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Reservado</span>
                              {(() => { const curr = products.find(p => p.id === editingId); return <span className="text-base font-bold text-white">{curr?.reserved_stock || 0}</span>; })()}
                            </div>
                            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                              <span className="text-emerald-500/70 text-[10px] font-bold uppercase tracking-widest">On Hand</span>
                              <span className="text-xl font-black text-emerald-400">{formData.stock}</span>
                              </div>
                            </div>

                            {/* AJUSTE MANUAL DE STOCK Y LOGS */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                              <div className="flex items-center gap-2">
                                <ArchiveRestore className="w-4 h-4 text-zinc-500" />
                                <h3 className="text-white font-bold text-sm">Historial de Stock</h3>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setShowAdjustForm(!showAdjustForm)} 
                                className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 transition"
                              >
                                Ajustar Stock On Hand
                              </button>
                            </div>

                            {showAdjustForm && (
                              <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl mb-4 space-y-4">
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleAdjustTypeChange('inc')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${adjustForm.type === 'inc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-black text-zinc-500 border border-white/5'}`}>Sumar</button>
                                  <button type="button" onClick={() => handleAdjustTypeChange('dec')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${adjustForm.type === 'dec' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-black text-zinc-500 border border-white/5'}`}>Restar</button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Cantidad</label>
                                    <input type="number" min="1" value={adjustForm.qty} onChange={e => setAdjustForm({...adjustForm, qty: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-indigo-500 outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Motivo</label>
                                    <select value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none">
                                      {adjustForm.type === 'inc' ? (
                                        <>
                                          <option value="Ingreso">Ingreso de Fabrica</option>
                                          <option value="Devolución">Devolución</option>
                                          <option value="Ajuste">Ajuste de Inventario</option>
                                        </>
                                      ) : (
                                        <>
                                          <option value="Venta Manual">Venta Manual</option>
                                            <option value="Dañado">Dañado / Defectuoso</option>
                                          <option value="Perdido">Perdido</option>
                                          <option value="Ajuste">Ajuste de Inventario</option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nota (Opcional)</label>
                                  <input type="text" placeholder="Ej. Lote #1234" value={adjustForm.note} onChange={e => setAdjustForm({...adjustForm, note: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <button type="button" onClick={handleQuickAdjustment} className="w-full bg-white text-black py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 transition">Confirmar Ajuste</button>
                              </div>
                            )}

                            <details className="mt-4 group border-t border-white/5 pt-4">
                              <summary className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-white transition list-none flex items-center justify-center gap-2 bg-white/5 py-3 rounded-xl border border-white/5 mb-4">
                                <span>Ver Historial de Movimientos</span>
                                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                              </summary>
                              
                              <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                                      <th className="py-3 px-2 font-bold">Fecha de Mov.</th>
                                      <th className="py-3 px-2 font-bold">Tipo / Motivo</th>
                                      <th className="py-3 px-2 font-bold text-center">Cant.</th>
                                      <th className="py-3 px-2 font-bold text-center">On Hand</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {productLogs.length === 0 ? (
                                      <tr><td colSpan="4" className="text-center py-6 text-zinc-500 text-xs">No hay movimientos registrados</td></tr>
                                    ) : (
                                      productLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition group">
                                          <td className="py-3 px-2 text-zinc-400">
                                            <div className="font-medium text-white">{new Date(log.created_at).toLocaleDateString('es-AR')}</div>
                                            <div className="text-[10px]">{new Date(log.created_at).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                                          </td>
                                          <td className="py-3 px-2">
                                            <div className="font-bold text-zinc-300">{log.reason}</div>
                                            {log.note && <div className="text-[10px] text-zinc-500 truncate max-w-[150px]" title={log.note}>{log.note}</div>}
                                          </td>
                                          <td className="py-3 px-2 text-center">
                                            <span className={`font-mono font-bold ${log.change_amount > 0 ? 'text-emerald-400 bg-emerald-400/10' : log.change_amount < 0 ? 'text-red-400 bg-red-400/10' : 'text-zinc-400 bg-zinc-800'} px-2 py-0.5 rounded-md`}>
                                              {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                            </span>
                                          </td>
                                          <td className="py-3 px-2 text-center font-bold text-white">
                                            {log.stock_after ?? '-'}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <ArchiveRestore className="w-8 h-8 text-zinc-700 mb-3" />
                          <h3 className="text-zinc-300 font-bold mb-1">Stock y Movimientos</h3>
                          <p className="text-xs text-zinc-500 max-w-[250px]">Guarda el producto por primera vez para poder gestionar su inventario y ver su historial.</p>
                        </div>
                      )}
                    </div>
                </form>
              </div>

              {/* Botonera Fija Footer */}
              <div className="p-4 border-t border-white/10 bg-zinc-900/90 backdrop-blur-xl flex justify-end gap-4 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-sm text-zinc-400 hover:text-white transition">Cerrar</button>
                <button type="button" onClick={handleSubmit} className="px-8 py-3 rounded-xl font-bold text-sm bg-indigo-500 hover:bg-indigo-400 text-white transition shadow-[0_0_20px_rgba(99,102,241,0.3)]">Guardar Todos los Cambios</button>
              </div>
            </div>
          </div>
      )}

      {isScannerOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={(code) => { setFormData(prev => ({ ...prev, barcode: code })); setIsScannerOpen(false); }}
            onClose={() => setIsScannerOpen(false)}
          />
        </Suspense>
      )}
    </div></>
  );
}
