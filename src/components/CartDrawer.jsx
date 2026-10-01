import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export default function CartDrawer() {
  const { cart, isCartOpen, toggleCart, updateQuantity, removeFromCart } = useStore();

  const total = cart.reduce((sum, item) => {
    const finalPrice = item.discount > 0 ? item.price * (1 - item.discount / 100) : item.price;
    return sum + (finalPrice * item.quantity);
  }, 0);

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay oscuro para fondo */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={toggleCart}
      />
      
      {/* Panel lateral derecho */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
        
        {/* Header del carrito */}
        <div className="flex items-center justify-between px-4 py-4 sm:p-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-zinc-900" />
            <h2 className="text-xl font-black text-zinc-900">Tu Carrito</h2>
          </div>
          <button onClick={toggleCart} aria-label="Cerrar carrito" className="p-2.5 -mr-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Lista de productos */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4">
              <ShoppingBag className="w-12 h-12 opacity-20" />
              <p className="font-medium">Tu carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => {
              const hasDiscount = item.discount > 0;
              const finalPrice = hasDiscount ? item.price * (1 - item.discount / 100) : item.price;
              
              return (
                <div key={item.id} className="flex gap-4">
                  {/* Miniatura */}
                  <div className="w-20 h-24 bg-[#f4f4f5] rounded-xl border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center p-2">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-zinc-300" />
                    )}
                  </div>
                  
                  {/* Info y Controles */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-zinc-900 leading-tight pr-2">{item.name}</h3>
                        <button onClick={() => removeFromCart(item.id)} aria-label={`Quitar ${item.name}`} className="p-2.5 -m-2.5 shrink-0 text-zinc-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm font-black text-zinc-900 mt-1">${finalPrice.toFixed(0)}</div>
                    </div>

                    {/* Cantidad */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-zinc-200 rounded-lg bg-white">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Restar una unidad" className="p-2.5 hover:bg-zinc-50 text-zinc-500 transition-colors">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Sumar una unidad" className="p-2.5 hover:bg-zinc-50 text-zinc-500 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer del carrito (Total y Checkout) */}
        {cart.length > 0 && (
          <div className="border-t border-zinc-100 p-4 sm:p-6 bg-[#fafafa]">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <span className="text-zinc-500 font-medium">Subtotal</span>
              <span className="text-2xl font-black text-zinc-900">${total.toFixed(0)}</span>
            </div>
            <button className="w-full bg-[#5c4ce5] hover:bg-[#4b3ed1] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center shadow-xl shadow-[#5c4ce5]/20">
              Iniciar Pago Seguro
            </button>
            <p className="text-center text-[10px] font-bold text-zinc-400 mt-4 uppercase tracking-widest">Pago encriptado</p>
          </div>
        )}
      </div>
    </>
  );
}
