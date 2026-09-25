import { ShoppingBag, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export default function HomePage() {
  const { products, addToCart } = useStore();

  // Filtrar solo los productos activos para la tienda pública
  const activeProducts = products.filter(p => p.isActive);

  return (
    <div className="flex flex-col bg-white">
      
      <section className="p-8 lg:p-12 max-w-7xl mx-auto w-full">
        
        {/* HEADER DEL CATÁLOGO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mb-2">Inicio / Catálogo</div>
            <h1 className="text-[2.75rem] leading-none font-black text-zinc-900 mb-3 tracking-tight">Sillones y Mesas</h1>
            <p className="text-zinc-500 font-medium">Mostrando {activeProducts.length} de 24 productos</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 bg-white border border-zinc-200 px-4 py-2.5 rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
            Ordenar por: <span className="font-bold text-black ml-1">Destacados</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        {activeProducts.length === 0 ? (
          <div className="text-center py-20 bg-zinc-50 rounded-3xl border border-zinc-200 text-zinc-500">
            No hay productos disponibles en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeProducts.map((p, index) => {
              const hasDiscount = p.discount > 0;
              const finalPrice = hasDiscount ? p.price * (1 - p.discount / 100) : p.price;
              
              // Para replicar el diseño exacto de la imagen, le damos el estilo "premium" al primer elemento o a los que tengan descuento.
              const isPremiumStyle = index === 0 || hasDiscount;

              return (
                <div key={p.id} className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform duration-300">
                  
                  {/* CONTENEDOR DE LA IMAGEN */}
                  <div className="h-[340px] bg-[#f4f4f5] flex flex-col items-center justify-center relative overflow-hidden">
                    
                    {/* Badges al estilo de la foto */}
                    <div className="absolute top-5 left-5 z-20">
                      {isPremiumStyle ? (
                        <div className="bg-[#5c4ce5] text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
                          <span className="w-1 h-1 bg-white rounded-full"></span>
                          {hasDiscount ? `${p.discount}% OFF` : 'NUEVO INGRESO'}
                        </div>
                      ) : (
                        <div className="bg-white text-zinc-500 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider border border-zinc-200">
                          VISTA 2D
                        </div>
                      )}
                    </div>

                    {p.stock === 0 && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                        <div className="bg-black text-white px-5 py-2.5 rounded-full font-bold text-sm tracking-wider uppercase shadow-xl">Agotado</div>
                      </div>
                    )}
                    
                    {/* IMAGEN CENTRADA */}
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        className="w-full h-full object-contain object-center z-10 mix-blend-multiply p-8" 
                      />
                    ) : (
                      <div className="text-zinc-400 font-medium flex flex-col items-center gap-3 z-10">
                        <ImageIcon className="w-12 h-12 text-zinc-300 opacity-50" />
                        <span className="text-sm font-bold opacity-50">Sin_Modelo.jpg</span>
                      </div>
                    )}
                  </div>
                  
                  {/* INFO DEL PRODUCTO */}
                  <div className="p-8 flex flex-col flex-1 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-[1.35rem] font-bold text-zinc-900 leading-tight pr-4 tracking-tight">{p.name}</h3>
                      <div className="text-right shrink-0">
                        <span className={`text-[1.35rem] font-black tracking-tight ${isPremiumStyle ? 'text-[#5c4ce5]' : 'text-zinc-900'}`}>
                          ${finalPrice.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-[#71717a] text-[15px] mb-8 leading-[1.6]">
                      {p.description}
                    </p>
                    
                    {isPremiumStyle ? (
                      <button 
                        onClick={() => addToCart(p)}
                        disabled={p.stock === 0} 
                        className="mt-auto w-full bg-black hover:bg-zinc-900 text-white font-bold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-black/10 hover:shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShoppingBag className="w-5 h-5" /> Añadir al Carrito
                      </button>
                    ) : (
                      <button 
                        onClick={() => addToCart(p)}
                        disabled={p.stock === 0} 
                        className="mt-auto w-full bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900 font-bold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShoppingBag className="w-5 h-5" /> Añadir al Carrito
                      </button>
                    )}
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
