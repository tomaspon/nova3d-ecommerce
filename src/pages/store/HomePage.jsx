import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, ChevronDown, Image as ImageIcon, SearchX, Heart, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { parseBannerUrl } from '../../bannerPosition';

export default function HomePage() {
  const { products, addToCart, favorites, toggleFavorite, storeSettings, categories, isLoading } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);

  const searchQuery = searchParams.get('q') || '';
  const sortBy = searchParams.get('sort') || 'destacados';

  const sortOptions = [
    { value: 'destacados', label: 'Destacados' },
    { value: 'precio_menor', label: 'Menor Precio' },
    { value: 'precio_mayor', label: 'Mayor Precio' }
  ];

  const currentSortLabel = sortOptions.find(o => o.value === sortBy)?.label || 'Destacados';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

    if (isLoading) {
      return (
        <div className="bg-[#FAFAFA] dark:bg-[#121212] min-h-screen pb-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-black dark:border-zinc-800 dark:border-t-white rounded-full animate-spin"></div>
        </div>
      );
    }

  const categoryFilter = searchParams.get('category') || 'all';
  let activeProducts = products.filter(p => p.is_active);
  
  const campaignProducts = activeProducts.filter(p => p.in_campaign);
  const campaignBanner = parseBannerUrl(storeSettings?.campaign_image_url);

  if (categoryFilter !== 'all') {
    activeProducts = activeProducts.filter(p => p.category === categoryFilter);
  }

  if (searchQuery) {
    activeProducts = activeProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  if (sortBy === 'precio_menor') activeProducts.sort((a, b) => a.price - b.price);
  if (sortBy === 'precio_mayor') activeProducts.sort((a, b) => b.price - a.price);

  return (
    <div className="bg-[#FAFAFA] dark:bg-[#121212] transition-colors duration-300 min-h-screen pb-12">
      
      {/* CAMPAÑA ACTIVA (Fase 3) */}
      {storeSettings?.campaign_active && !searchQuery && (
        <section className="bg-white dark:bg-transparent border-b border-zinc-200 dark:border-white/5 transition-colors">
          
          {/* Banner Hero (Opcional) */}
          {storeSettings.campaign_image_url && (
            <div className="w-full h-40 md:h-64 lg:h-80 relative">
              <img fetchpriority="high" src={campaignBanner.src} alt="Campaña promocional" className="w-full h-full object-cover" style={{ objectPosition: `50% ${campaignBanner.y}%` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6 w-full max-w-screen-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-lg">
                  {storeSettings.campaign_name}
                </h2>
              </div>
            </div>
          )}

          {/* Carrusel de Productos Seleccionados */}
          {campaignProducts.length > 0 && (
            <div className={`max-w-screen-2xl mx-auto px-6 lg:px-12 py-8 ${storeSettings.campaign_image_url ? 'pt-6' : ''}`}>
              {!storeSettings.campaign_image_url && (
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
                      {storeSettings.campaign_name}
                    </h2>
                    <p className="text-zinc-500 text-xs mt-1">Productos destacados</p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {campaignProducts.map(p => {
                  const finalPrice = p.price * (1 - (p.discount || 0) / 100);
                  return (
                    <div key={p.id} onClick={() => navigate(`/producto/${p.id}`)} className="w-36 md:w-48 shrink-0 snap-start group cursor-pointer">
                      <div className="aspect-[4/5] bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl relative overflow-hidden mb-3 border border-zinc-100 dark:border-white/5 transition-colors">
                        {p.discount > 0 && (
                          <div className="absolute top-2 left-2 z-20">
                            <div className="bg-red-500/90 backdrop-blur-md border border-red-400/20 text-white px-2.5 py-1 rounded-md text-[8px] md:text-[9px] font-black px-2 py-1 md:px-3 md:py-1.5 tracking-widest shadow-sm">
                              {p.discount}% OFF
                            </div>
                          </div>
                        )}
                        {p.imageUrl ? (
                          <img loading="lazy" src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-zinc-300 dark:text-zinc-700" /></div>
                        )}
                      </div>
                      <h3 className="font-bold text-zinc-900 dark:text-white text-sm truncate mb-0.5">{p.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">${finalPrice.toLocaleString('es-AR')}</span>
                        {p.discount > 0 && <span className="text-[10px] text-zinc-400 line-through">${p.price.toLocaleString('es-AR')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* HEADER DEL CATÁLOGO */}
      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-12 pt-6 lg:pt-8">
        
        {/* Filtros de Categoría (Pills) */}
        {categories.length > 0 && (
          <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-1">
            <button
              onClick={() => {
                setSearchParams(prev => {
                  prev.delete('category');
                  return prev;
                });
              }}
              className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all duration-300 ${
                categoryFilter === 'all'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              Ver Todo
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSearchParams(prev => {
                    prev.set('category', cat);
                    return prev;
                  });
                }}
                className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all duration-300 ${
                  categoryFilter === cat
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-[0.2em] uppercase mb-1">Inicio / Catálogo {categoryFilter !== 'all' ? `/ ${categoryFilter}` : ''}</div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mb-1 tracking-tight transition-colors">
              {searchQuery ? `Resultados para "${searchQuery}"` : categoryFilter !== 'all' ? categoryFilter : 'Catálogo General'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">Mostrando {activeProducts.length} productos disponibles</p>
          </div>
          
          <div className="relative" ref={sortRef}>
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-6 py-2.5 rounded-full text-sm font-bold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
            >
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Ordenar por:</span> {currentSortLabel}
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                {sortOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSearchParams(prev => {
                        prev.set('sort', option.value);
                        return prev;
                      });
                      setIsSortOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${
                      sortBy === option.value 
                        ? 'bg-zinc-50 dark:bg-white/5 text-indigo-600 dark:text-indigo-400' 
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        {activeProducts.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-full flex items-center justify-center mb-6">
              <SearchX className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">No se encontraron productos</h3>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md">Intentá ajustar tu búsqueda o explorá otras categorías para encontrar lo que buscás.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
            {activeProducts.map(product => {
              const finalPrice = product.price * (1 - (product.discount || 0) / 100);
              const isFavorite = favorites.includes(product.id);
              
              return (
                <div key={product.id} className="group cursor-pointer" onClick={() => navigate(`/producto/${product.id}`)}>
                  
                  <div className="aspect-[4/5] bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl relative overflow-hidden mb-4 border border-zinc-100 dark:border-white/5 shadow-sm group-hover:shadow-xl transition-all duration-500">
                    
                    {/* Tags */}
                    <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
                      {product.stock <= 0 ? (
                        <div className="bg-black/60 dark:bg-white/20 backdrop-blur-md border border-white/10 text-white px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black px-2 py-1 md:px-3 md:py-1.5 tracking-widest uppercase">
                          Agotado
                        </div>
                      ) : product.available_stock > 0 && product.available_stock <= 5 && (
                        <div className="bg-amber-500/90 backdrop-blur-md border border-amber-400/20 text-white px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black px-2 py-1 md:px-3 md:py-1.5 tracking-widest uppercase shadow-sm">¡ÚLTIMOS {product.available_stock}!
                          </div>
                      )}
                      
                      {product.discount > 0 && (
                        <div className="bg-red-500/90 backdrop-blur-md border border-red-400/20 text-white px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black px-2 py-1 md:px-3 md:py-1.5 tracking-widest uppercase shadow-sm">
                          {product.discount}% OFF
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                      className="absolute top-3 right-3 z-20 w-10 h-10 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center md:opacity-0 opacity-100 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                    >
                      <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-600 dark:text-white'}`} />
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.stock > 0 || storeSettings.allow_backorders) {
                          addToCart(product);
                        }
                      }}
                      disabled={product.stock <= 0 && !storeSettings.allow_backorders}
                      className="absolute bottom-3 right-3 z-20 w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:scale-100"
                    >
                      <Plus className="w-6 h-6" />
                    </button>

                    {product.imageUrl ? (
                      <img loading="lazy" src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-black/20">
                        <ImageIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm md:text-base leading-tight mb-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{product.name}</h3>
                  {product.category && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold">{product.category}</span>}
                  
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-900 dark:text-white">${finalPrice.toLocaleString('es-AR')}</span>
                    {product.discount > 0 && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 line-through">${product.price.toLocaleString('es-AR')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
