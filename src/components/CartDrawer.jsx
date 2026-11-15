import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsTotal, formatMoney } from '../pricing';
import { useStore } from '../context/StoreContext';
import { availablePaymentMethods, storeWhatsappLink } from '../paymentMethods';
import { ShoppingBag, X, Plus, Minus, CheckCircle2, Loader2, MapPin, Phone, User, Mail, CreditCard, Landmark } from 'lucide-react';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { store, cart, isCartOpen, toggleCart, removeFromCart, updateQuantity, checkoutOrder, user, storeSettings } = useStore();
  // Solo los medios de pago que esta tienda configuró
  const paymentMethods = availablePaymentMethods(store, storeSettings);
  const [checkoutStep, setCheckoutStep] = useState('cart'); // cart, form, loading, success
  const [orderInfo, setOrderInfo] = useState(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '',
    phone: '',
    document: '',
    address: { street: '', number: '', city: '', zip: '', apartment: '', state: '' },
    paymentMethod: 'MercadoPago'
  });

  React.useEffect(() => {
    if (user && isCartOpen) {
      // Con sesión iniciada el pedido va siempre con el email de la cuenta, para que aparezca en "Mis pedidos"
      setFormData(prev => ({
        ...prev,
        ...(user.user_metadata?.shipping || {}),
        email: user.email
      }));
    }
  }, [user, isCartOpen]);


  // Si el medio elegido no está disponible en esta tienda, se elige el primero que sí
  React.useEffect(() => {
    if (paymentMethods.length && !paymentMethods.includes(formData.paymentMethod)) {
      setFormData(prev => ({ ...prev, paymentMethod: paymentMethods[0] }));
    }
  }, [paymentMethods.join(), formData.paymentMethod]);

  // El envío es un costo fijo definido en Configuración; la base lo suma igual al crear la orden
  const subtotal = itemsTotal(cart);
  const shippingCost = Number(storeSettings?.shipping_cost) || 0;
  const total = subtotal + shippingCost;

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (store?.isDemo) return; // tienda de ejemplo: no se hacen pedidos
    setCheckoutStep('loading');
    
    const res = await checkoutOrder(formData);
    if (res.success) {
      if (formData.paymentMethod === 'MercadoPago') {
        try {
          const mpResponse = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: res.orderId,
              items: cart,
              payer: {
                name: formData.name,
                email: formData.email
              }
            })
          });
          
          const mpData = await mpResponse.json();
          if (mpData.init_point) {
            window.location.href = mpData.init_point;
          } else {
            setOrderInfo({ id: res.orderId, total: res.total, method: 'MercadoPagoError' });
            setCheckoutStep('success');
          }
        } catch (error) {
          console.error(error);
          setOrderInfo({ id: res.orderId, total: res.total, method: 'MercadoPagoError' });
          setCheckoutStep('success');
        }
      } else {
        // Transferencia Bancaria
        setOrderInfo({ id: res.orderId, total: res.total, method: formData.paymentMethod });
        setCheckoutStep('success');
      }
    } else {
      alert(res.errorMessage || "Error procesando el pago. Intentá de nuevo.");
      setCheckoutStep('form');
    }
  };

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity animate-in fade-in" 
        onClick={toggleCart}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-zinc-950 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-white/10 transition-colors">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 transition-colors">
            {checkoutStep === 'success' ? 'Pedido Confirmado' : checkoutStep === 'form' ? 'Checkout' : 'Tu Carrito'}
          </h2>
          <button onClick={toggleCart} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors group">
            <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {checkoutStep === 'success' ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
              <CheckCircle2 className="w-20 h-20 text-emerald-500 mb-6" />
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 transition-colors">¡Orden #{orderInfo?.id?.split('-')[0]} Confirmada!</h3>
              <p className="text-zinc-500 dark:text-zinc-400 transition-colors mb-8">
                Guardá tu número de pedido: lo podés seguir desde la sección Seguimiento con tu DNI.
              </p>
              
              {orderInfo?.method === 'MercadoPagoError' && (
                <p className="w-full mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-800 dark:text-amber-200">
                  No pudimos abrir MercadoPago. Tu pedido quedó reservado: {paymentMethods.includes('Transferencia') ? 'podés pagarlo por transferencia con estos datos.' : 'escribile a la tienda para coordinar el pago.'}
                </p>
              )}
              <TransferDetails settings={storeSettings} order={orderInfo} showTransfer={orderInfo?.method === 'Transferencia' || (orderInfo?.method === 'MercadoPagoError' && paymentMethods.includes('Transferencia'))} />
            </div>
          ) : checkoutStep === 'form' || checkoutStep === 'loading' ? (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
              
              {/* Sección Datos de Contacto */}
              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Datos de Contacto</h3>
                <div className="space-y-3">
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Nombre Completo" disabled={checkoutStep === 'loading'} />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input required type="text" value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="DNI / Documento" disabled={checkoutStep === 'loading'} />
                    <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Teléfono" disabled={checkoutStep === 'loading'} />
                  </div>
                  
                  {user ? (
                    // Con cuenta: el pedido queda asociado a su email y aparece en "Mis pedidos"
                    <div className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Comprando con tu cuenta</div>
                      <div className="font-bold text-zinc-900 dark:text-white break-all">{user.email}</div>
                    </div>
                  ) : (
                    <>
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Correo Electrónico" disabled={checkoutStep === 'loading'} />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Podés comprar sin cuenta.{' '}
                        <button type="button" onClick={() => { toggleCart(); navigate('/login?redirect=carrito'); }} className="font-bold text-black dark:text-white underline underline-offset-2">
                          Iniciá sesión
                        </button>{' '}
                        para guardar tus datos y ver tus pedidos.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Sección Dirección */}
              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Envío</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input required type="text" value={formData.address.street} onChange={e => setFormData({...formData, address: {...formData.address, street: e.target.value}})} className="col-span-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Calle" disabled={checkoutStep === 'loading'} />
                    <input required type="text" value={formData.address.number} onChange={e => setFormData({...formData, address: {...formData.address, number: e.target.value}})} className="col-span-1 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Número" disabled={checkoutStep === 'loading'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={formData.address.apartment} onChange={e => setFormData({...formData, address: {...formData.address, apartment: e.target.value}})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Depto / Piso (Opc)" disabled={checkoutStep === 'loading'} />
                    <input required type="text" value={formData.address.zip} onChange={e => setFormData({...formData, address: {...formData.address, zip: e.target.value}})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Cód. Postal" disabled={checkoutStep === 'loading'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input required type="text" value={formData.address.city} onChange={e => setFormData({...formData, address: {...formData.address, city: e.target.value}})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Ciudad" disabled={checkoutStep === 'loading'} />
                    <input required type="text" value={formData.address.state} onChange={e => setFormData({...formData, address: {...formData.address, state: e.target.value}})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" placeholder="Provincia" disabled={checkoutStep === 'loading'} />
                  </div>
                </div>
              </div>

              {/* Sección Pago */}
              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Método de Pago</h3>
                {paymentMethods.length === 0 && (
                  <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-800 dark:text-amber-200">
                    Esta tienda todavía no configuró sus medios de pago.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3">
                  {paymentMethods.includes('MercadoPago') && (
                  <label className={`border p-4 rounded-xl cursor-pointer transition-colors flex items-center gap-3 ${formData.paymentMethod === 'MercadoPago' ? 'border-[#009EE3] bg-[#009EE3]/5' : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5'}`}>
                    <input type="radio" name="payment" value="MercadoPago" checked={formData.paymentMethod === 'MercadoPago'} onChange={() => setFormData({...formData, paymentMethod: 'MercadoPago'})} className="sr-only" />
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.paymentMethod === 'MercadoPago' ? 'border-[#009EE3]' : 'border-zinc-400'}`}>
                      {formData.paymentMethod === 'MercadoPago' && <div className="w-2.5 h-2.5 bg-[#009EE3] rounded-full"></div>}
                    </div>
                    <span className="font-bold text-sm text-zinc-900 dark:text-white flex-1">MercadoPago</span>
                  </label>
                  )}

                  {paymentMethods.includes('Transferencia') && (
                  <label className={`border p-4 rounded-xl cursor-pointer transition-colors flex items-center gap-3 ${formData.paymentMethod === 'Transferencia' ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5'}`}>
                    <input type="radio" name="payment" value="Transferencia" checked={formData.paymentMethod === 'Transferencia'} onChange={() => setFormData({...formData, paymentMethod: 'Transferencia'})} className="sr-only" />
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.paymentMethod === 'Transferencia' ? 'border-indigo-500' : 'border-zinc-400'}`}>
                      {formData.paymentMethod === 'Transferencia' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
                    </div>
                    <span className="font-bold text-sm text-zinc-900 dark:text-white flex-1">Transferencia Bancaria</span>
                    <Landmark className="w-4 h-4 text-zinc-400" />
                  </label>
                  )}
                </div>
              </div>

            </form>
          ) : cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-100 dark:border-white/5 shadow-inner transition-colors">
                <ShoppingBag className="w-10 h-10 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight transition-colors">Tu carrito está vacío</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 font-medium transition-colors">Aún no elegiste ningún producto.</p>
              <button 
                onClick={() => { toggleCart(); navigate('/'); }}
                className="bg-brand hover:opacity-90 text-brand-ink font-bold py-3.5 px-8 rounded-full transition-all duration-300 shadow-lg shadow-black/10 dark:shadow-white/10 hover:shadow-black/20"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            cart.map(item => {
              const hasDiscount = item.discount > 0;
              const finalPrice = hasDiscount ? item.price * (1 - item.discount / 100) : item.price;
              
              return (
                <div key={item.id} className="flex gap-4 group">
                  <div className="w-20 h-24 bg-[#f4f4f5] dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-2 group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                    {item.imageUrl ? (
                      <img loading="lazy" decoding="async" src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-zinc-900 dark:text-white leading-tight pr-4 transition-colors">{item.name}</h3>
                        <button onClick={() => removeFromCart(item.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm font-black text-zinc-900 dark:text-white mt-1 transition-colors">${Math.round(finalPrice).toLocaleString('es-AR')}</div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-zinc-200 dark:border-white/20 rounded-lg bg-white dark:bg-zinc-800 overflow-hidden shadow-sm transition-colors">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold dark:text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && checkoutStep !== 'success' && (
          <div className="border-t border-zinc-100 dark:border-white/10 p-6 bg-[#fafafa] dark:bg-[#121212] transition-colors">
            {shippingCost > 0 && (
              <div className="space-y-1 mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                <div className="flex justify-between"><span>Envío</span><span>{formatMoney(shippingCost)}</span></div>
              </div>
            )}
            <div className="flex justify-between items-center mb-6">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium transition-colors">Total a pagar</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-white transition-colors">{formatMoney(total)}</span>
            </div>
            
            {checkoutStep === 'cart' ? (
              <button onClick={() => setCheckoutStep('form')} className="w-full bg-brand hover:opacity-90 text-brand-ink font-bold py-4 rounded-xl transition-all flex items-center justify-center shadow-xl shadow-black/10 hover:-translate-y-0.5 active:scale-[0.98]">
                Siguiente Paso
              </button>
            ) : (
              <button
                // En la tienda de ejemplo el botón se presiona pero no hace nada: es solo una muestra
                type={store?.isDemo ? 'button' : 'submit'}
                form={store?.isDemo ? undefined : 'checkout-form'}
                disabled={checkoutStep === 'loading' || paymentMethods.length === 0}
                className="w-full bg-brand hover:opacity-90 text-brand-ink font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
              >
                {checkoutStep === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                ) : (
                  'Confirmar Pedido'
                )}
              </button>
            )}
            
            <p className="text-center text-[10px] font-bold text-zinc-400 dark:text-zinc-600 mt-4 uppercase tracking-widest transition-colors">
              {checkoutStep === 'cart' ? 'Pago seguro encriptado' : 'Transacción segura cifrada'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// Datos para pagar por transferencia y avisar por WhatsApp: los de la tienda, no fijos
function TransferDetails({ settings, order, showTransfer }) {
  const shortId = order?.id?.split('-')[0];
  const total = order?.total?.toLocaleString('es-AR');
  const whatsapp = storeWhatsappLink(settings, showTransfer
    ? `Hola! Hice el pedido #${shortId} por $${total} y ya transferí. Te paso el comprobante:`
    : `Hola! Hice el pedido #${shortId} por $${total}.`);

  return (
    <div className="w-full space-y-4">
      {showTransfer && (
        <div className="bg-zinc-100 dark:bg-white/5 p-5 rounded-xl border border-zinc-200 dark:border-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 font-medium">Transferí el total a esta cuenta:</p>
          <div className="bg-white dark:bg-[#121212] rounded-xl p-4 border border-zinc-200 dark:border-white/10 text-center space-y-1">
            {settings?.transfer_alias && <p className="text-xl font-black text-zinc-900 dark:text-white break-all">{settings.transfer_alias}</p>}
            {settings?.transfer_cbu && <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all">CBU/CVU {settings.transfer_cbu}</p>}
            {settings?.transfer_holder && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{settings.transfer_holder}</p>}
          </div>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-5 text-center">Total: ${total}</p>
        </div>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center shadow-lg shadow-[#25D366]/20 hover:-translate-y-0.5"
        >
          {showTransfer ? 'Ya pagué · Enviar comprobante' : 'Escribirle a la tienda'}
        </a>
      )}
    </div>
  );
}
