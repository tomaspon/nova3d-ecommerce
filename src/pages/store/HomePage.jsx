import { ShoppingBag, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export default function HomePage() {
  const { products, addToCart, isLoading, loadError } = useStore();

  // Filtrar solo los productos activos para la tienda pública
  const activeProducts = products.filter(p => p.isActive);

  return (
    <div className="flex flex-col bg-white">
      
      <section className="px-4 py-6 sm:p-8 lg:p-12 max-w-7xl mx-auto w-full">

        {/* HEADER DEL CATÁLOGO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 md:mb-10 gap-4">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mb-2">Inicio / Catálogo</div>
            <h1 className="text-3xl md:text-[2.75rem] leading-none font-black text-zinc-900 mb-2 md:mb-3 tracking-tight">Sillones y Mesas</h1>
            {!isLoading && !loadError && (
              <p className="text-sm md:text-base text-zinc-500 font-medium">
                Mostrando {activeProducts.length} {activeProducts.length === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 bg-white border border-zinc-200 px-4 py-2.5 rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
            Ordenar por: <span className="font-bold text-black ml-1">Destacados</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        {isLoading ? (
          <div className="text-center px-6 py-16 md:py-20 bg-zinc-50 rounded-3xl border border-zinc-200 text-zinc-500">
            Cargando productos...
          </div>
        ) : loadError ? (
          <div className="text-center px-6 py-16 md:py-20 bg-zinc-50 rounded-3xl border border-zinc-200 text-zinc-500">
            No pudimos cargar el catálogo. Probá de nuevo en unos minutos.
          </div>
        ) : activeProducts.length === 0 ? (
          <div className="text-center px-6 py-16 md:py-20 bg-zinc-50 rounded-3xl border border-zinc-200 text-zinc-500">
            No hay productos disponibles en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
            {activeProducts.map((p, index) => {
              const hasDiscount = p.discount > 0;
              const finalPrice = hasDiscount ? p.price * (1 - p.discount / 100) : p.price;
              
              // Para replicar el diseño exacto de la imagen, le damos el estilo "premium" al primer elemento o a los que tengan descuento.
              const isPremiumStyle = index === 0 || hasDiscount;

              return (
                <div key={p.id} className="bg-white rounded-2xl sm:rounded-[2rem] border border-zinc-200 overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform duration-300">

                  {/* CONTENEDOR DE LA IMAGEN */}
                  <div className="aspect-square sm:aspect-auto sm:h-[340px] bg-[#f4f4f5] flex flex-col items-center justify-center relative overflow-hidden">

                    {/* Badges al estilo de la foto */}
                    <div className="absolute top-2.5 left-2.5 sm:top-5 sm:left-5 z-20">
                      {isPremiumStyle ? (
                        <div className="bg-[#5c4ce5] text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
                          <span className="w-1 h-1 bg-white rounded-full"></span>
                          {hasDiscount ? `${p.discount}% OFF` : 'NUEVO INGRESO'}
                        </div>
                      ) : (
                        <div className="bg-white text-zinc-500 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider border border-zinc-200">
                          VISTA 2D
                        </div>
                      )}
                    </div>

                    {p.stock === 0 && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                        <div className="bg-black text-white px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-[11px] sm:text-sm tracking-wider uppercase shadow-xl">Agotado</div>
                      </div>
                    )}

                    {/* IMAGEN CENTRADA */}
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-contain object-center z-10 mix-blend-multiply p-4 sm:p-8"
                      />
                    ) : (
                      <div className="text-zinc-400 font-medium flex flex-col items-center gap-2 sm:gap-3 z-10">
                        <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-300 opacity-50" />
                        <span className="text-xs sm:text-sm font-bold opacity-50">Sin_Modelo.jpg</span>
                      </div>
                    )}
                  </div>

                  {/* INFO DEL PRODUCTO */}
                  <div className="p-3.5 sm:p-8 flex flex-col flex-1 bg-white">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-2 sm:mb-3">
                      <h3 className="text-[15px] sm:text-[1.35rem] font-bold text-zinc-900 leading-tight sm:pr-4 tracking-tight">{p.name}</h3>
                      <div className="sm:text-right shrink-0">
                        <span className={`text-base sm:text-[1.35rem] font-black tracking-tight ${isPremiumStyle ? 'text-[#5c4ce5]' : 'text-zinc-900'}`}>
                          ${finalPrice.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[#71717a] text-[13px] sm:text-[15px] mb-4 sm:mb-8 leading-normal sm:leading-[1.6] line-clamp-2 sm:line-clamp-none">
                      {p.description}
                    </p>

                    <button
                      onClick={() => addToCart(p)}
                      disabled={p.stock === 0}
                      className={`mt-auto w-full font-bold text-sm sm:text-base py-3 sm:py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isPremiumStyle ? 'bg-black hover:bg-zinc-900 text-white shadow-lg shadow-black/10 hover:shadow-black/20' : 'bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900'}`}
                    >
                      <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="sm:hidden">Añadir</span>
                      <span className="hidden sm:inline">Añadir al Carrito</span>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  );
}
