import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, Heart, Share2, ChevronLeft, ChevronRight, Check, Minus, Plus, Truck, ArrowRightLeft } from 'lucide-react';

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-200 dark:border-white/10">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center py-4 text-left text-xs font-bold tracking-widest uppercase text-zinc-900 dark:text-zinc-100 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
      >
        {title}
        <span className="text-lg font-light">{isOpen ? '-' : '+'}</span>
      </button>
      {isOpen && (
        <div className="pb-6 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, addToCart, favorites, toggleFavorite, storeSettings } = useStore();
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const product = products.find(p => p.id === id);
  const relatedProducts = products.filter(p => p.category === product?.category && p.id !== product?.id).slice(0, 4);

  // Fallback to imageUrl if images array is not available
  const images = product?.images?.length > 0 ? product.images : (product?.imageUrl ? [product.imageUrl] : []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentImageIndex(0);
    setQuantity(1);
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#121212] transition-colors">
        <div className="text-center">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 uppercase tracking-tighter">Producto no encontrado</h2>
          <button onClick={() => navigate('/')} className="text-sm font-bold uppercase tracking-widest underline decoration-2 underline-offset-4 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const isFavorite = favorites.includes(product.id);
  const isOutOfStock = product.available_stock <= 0;
  const hasDiscount = product.discount > 0;
  const finalPrice = hasDiscount ? product.price * (1 - product.discount / 100) : product.price;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar el enlace', err);
    }
  };

  const handleAddToCart = () => {
    if (!isOutOfStock) {
      addToCart(product, quantity);
    }
  };

  const nextImage = () => setCurrentImageIndex(prev => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] transition-colors pb-32 lg:pb-12">
      
      {/* HEADER NAVEGACION (MOBILE & DESKTOP) */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 transition-colors">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Volver</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* COLUMNA IZQUIERDA: GALERÍA DE IMÁGENES */}
          <div className="w-full lg:w-[48%] lg:max-w-[600px] mx-auto">
            <div className="relative aspect-square w-full bg-[#f4f4f5] dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden flex items-center justify-center transition-colors group">
              
              {hasDiscount && (
                <div className="absolute top-6 left-6 z-10 bg-black dark:bg-white text-white dark:text-black text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl">
                  {product.discount}% OFF
                </div>
              )}

              {images.length > 0 ? (
                <>
                  <img 
                    src={images[currentImageIndex]} 
                    alt={product.name} 
                    className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-700" 
                  />
                  
                  {/* Controles de Carrusel */}
                  {images.length > 1 && (
                    <>
                      <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 dark:bg-black/90 rounded-full flex items-center justify-center shadow-lg border border-black/5 opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                        <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
                      </button>
                      <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 dark:bg-black/90 rounded-full flex items-center justify-center shadow-lg border border-black/5 opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                        <ChevronRight className="w-6 h-6 text-black dark:text-white" />
                      </button>
                      
                      {/* Puntos Indicadores */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((_, i) => (
                          <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-black dark:bg-white w-6' : 'bg-black/20 dark:bg-white/20'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-zinc-300 dark:text-zinc-600 font-medium text-sm">Sin imagen disponible</div>
              )}
            </div>
            
            {/* Miniaturas */}
            {images.length > 1 && (
              <div className="flex gap-4 mt-4 overflow-x-auto custom-scrollbar pb-2">
                {images.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-20 h-20 shrink-0 bg-[#f4f4f5] dark:bg-zinc-900 rounded-xl border-2 transition-all overflow-hidden ${idx === currentImageIndex ? 'border-black dark:border-white' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: INFORMACIÓN IDENTIDAD */}
          <div className="w-full lg:w-[48%] lg:pt-0">
            
            {/* Categoría & Acciones Superiores */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/10 mb-6 transition-colors">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Tienda / {product.category || 'Colección'}
              </span>
              
              <div className="flex gap-4">
                <button onClick={handleShare} className="text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors" title="Copiar enlace">
                  {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
                </button>
                <button onClick={() => toggleFavorite(product.id)} className={`transition-colors ${isFavorite ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500 hover:text-red-500'}`}>
                  <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* Título & Precio */}
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-tight mb-2 transition-colors">
                {product.name}
              </h1>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-4">
                  <span className="text-3xl font-bold text-zinc-900 dark:text-white transition-colors">
                    ${finalPrice.toLocaleString('es-AR')}
                  </span>
                  {hasDiscount && (
                    <span className="text-lg text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-300 dark:decoration-zinc-600 mb-1">
                      ${product.price.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
                {hasDiscount && <span className="text-emerald-500 font-bold text-sm tracking-wide">Ahorrás ${(product.price - finalPrice).toLocaleString('es-AR')}</span>}
              </div>
            </div>

            {/* Controles de Compra (Desktop) */}
            <div className="hidden lg:block bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl p-5 border border-zinc-200 dark:border-white/5 mb-6 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden h-12 transition-colors">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-5 h-full hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-bold text-zinc-900 dark:text-white text-lg">{quantity}</span>
                  <button onClick={() => {
                      const maxQty = (!storeSettings.allow_backorders) ? product.available_stock : 9999;
                      setQuantity(Math.min(maxQty, quantity + 1));
                    }} className="px-5 h-full hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <button 
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="flex-1 h-12 bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-sm rounded-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed shadow-xl shadow-black/10 dark:shadow-white/10"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {isOutOfStock ? 'Sin Stock' : 'Agregar al Carrito'}
                </button>
              </div>
              
              {isOutOfStock ? (
                  <p className="text-red-500 text-sm font-bold text-center">Actualmente sin stock disponible.</p>
                ) : (
                  <p className="text-emerald-500 text-sm font-bold flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Hay stock disponible
                  </p>
                )}
            </div>

            {/* Accordions de Detalles */}
            <div className="mb-12">
              <Accordion title="Descripción" defaultOpen={true}>
                <p className="whitespace-pre-line text-sm lg:text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {product.description || "Un diseño minimalista pensado para destacar. Construido con materiales de primera calidad."}
                </p>
              </Accordion>
              
              <Accordion title="Especificaciones">
                {product.features && product.features.length > 0 ? (
                  <ul className="space-y-3">
                    {product.features.map((feature, idx) => (
                      <li key={idx} className={`flex items-start gap-4 p-3 rounded-lg ${idx % 2 === 0 ? 'bg-zinc-50 dark:bg-zinc-900/50' : 'bg-transparent'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white mt-1.5 shrink-0" />
                        <span className="text-zinc-600 dark:text-zinc-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Dimensiones estándar. Consulta al soporte para medidas precisas.</p>
                )}
              </Accordion>
              
              <Accordion title="Envíos y Devoluciónes">
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <Truck className="w-5 h-5 text-zinc-900 dark:text-white shrink-0 mt-0.5" />
                    <div>
                      <p className="text-zinc-900 dark:text-white font-bold mb-1">Envíos a todo el país</p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm">Despachamos tu pedido en 24-48hs hábiles vía Andreani o Correo Argentino.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <ArrowRightLeft className="w-5 h-5 text-zinc-900 dark:text-white shrink-0 mt-0.5" />
                    <div>
                      <p className="text-zinc-900 dark:text-white font-bold mb-1">Cambios y devoluciones</p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm">Tenés 30 días para devolver el producto si no te convence. Sin vueltas.</p>
                    </div>
                  </div>
                </div>
              </Accordion>
            </div>
          </div>
        </div>

        {/* RELATED PRODUCTS */}
        {relatedProducts.length > 0 && (
          <div className="mt-24 border-t border-zinc-200 dark:border-white/10 pt-16">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-8">También te puede interesar</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(p => {
                const pFinalPrice = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
                return (
                  <div key={p.id} className="group cursor-pointer" onClick={() => navigate(`/producto/${p.id}`)}>
                    <div className="relative aspect-[4/5] bg-[#f4f4f5] dark:bg-zinc-900 rounded-2xl overflow-hidden mb-4">
                      {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />}
                      {p.discount > 0 && <span className="absolute top-3 left-3 bg-black/60 dark:bg-white/20 backdrop-blur-md border border-white/10 text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest">{p.discount}%</span>}
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base leading-tight mb-1 group-hover:text-emerald-500 transition-colors">{p.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-zinc-900 dark:text-white">${pFinalPrice.toLocaleString('es-AR')}</span>
                        {p.discount > 0 && <span className="text-xs text-zinc-400 line-through">${p.price.toLocaleString('es-AR')}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* STICKY CTA (Solo Móvil) */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200 dark:border-white/10 p-4 z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-4 max-w-md mx-auto">
          <div className="flex flex-col flex-1 shrink-0">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest truncate">{product.name}</span>
            <span className="text-lg font-black text-black dark:text-white">${finalPrice.toLocaleString('es-AR')}</span>
          </div>
          <button 
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="flex-1 shrink-0 h-12 bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs rounded-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl"
          >
            <ShoppingBag className="w-4 h-4" />
            {isOutOfStock ? 'Sin Stock' : 'Agregar'}
          </button>
        </div>
      </div>

    </div>
  );
}
