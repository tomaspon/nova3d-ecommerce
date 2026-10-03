import React, { useState, useEffect } from 'react';
import { Search, Loader2, Package, Truck, CheckCircle2, AlertCircle, Calendar, ClipboardCheck, MapPin, MessageCircle, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../../storeContact';
import { isAwaitingPayment, isPaid as isOrderPaid, isCanceled as isOrderCanceled, trackingStep } from '../../orderStatus';
import { lineTotal, formatMoney } from '../../pricing';

export default function TrackingPage() {
  const [document, setDocument] = useState('');
  const [orders, setOrders] = useState([]); // Can be multiple if searching by DNI
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Resultado del checkout cuando se vuelve de Mercado Pago: 'success' | 'pending' | 'failure'
  const [paymentReturn, setPaymentReturn] = useState(null);

  // Auto-load si viene de Mercado Pago
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderIdParam = searchParams.get('order');
    const paymentIdParam = searchParams.get('payment_id') || searchParams.get('collection_id');
    let cancelled = false;

    const loadFromCheckout = async () => {
      setPaymentReturn(searchParams.get('payment'));

      // Confirmar el pago contra Mercado Pago sin esperar al webhook
      if (paymentIdParam && /^\d+$/.test(paymentIdParam)) {
        try {
          await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: paymentIdParam })
          });
        } catch (err) {
          console.error('No se pudo verificar el pago:', err);
        }
      }

      let order = await fetchOrderByID(orderIdParam);

      // Si el pago salió bien pero la orden todavía no figura pagada, reintentar unos segundos
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        if (!order || searchParams.get('payment') !== 'success' || !isAwaitingPayment(order.status)) break;
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (!cancelled) order = await fetchOrderByID(orderIdParam, { silent: true });
      }
    };

    if (orderIdParam) {
      loadFromCheckout();
    } else {
      setIsLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  const fetchOrderByID = async (id, { silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      // El id es un uuid: se compara exacto (ilike no existe para uuid en Postgres)
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !data) {
        throw new Error('No pudimos encontrar los detalles de este pedido.');
      }
      setSelectedOrder(data);
      return data;
    } catch (err) {
      if (!silent) setError(err.message);
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!document) return;

    setIsLoading(true);
    setError('');
    setSelectedOrder(null);
    setOrders([]);

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_document', document)
      .not('status', 'ilike', 'cancelado%')
        .order('created_at', { ascending: false });

      if (fetchError || !data || data.length === 0) {
        throw new Error('No encontramos pedidos asociados a este documento.');
      }
      
      if (data.length === 1) {
        setSelectedOrder(data[0]);
      } else {
        setOrders(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Recién comprado (pago pendiente o ya pagado) queda en "Ordenado" hasta que el vendedor lo prepare o despache
  const step = selectedOrder ? trackingStep(selectedOrder.status) : 0;
  const isCanceled = isOrderCanceled(selectedOrder?.status);
  const isPaid = isOrderPaid(selectedOrder?.status);
  const isConfirmingPayment = !isPaid && !isCanceled && paymentReturn === 'success';
  const shippingLabel = ['', 'Pendiente de despacho', 'En preparación', 'En camino', 'Entregado'][step];
  const nextStepMessage = [
    '',
    isPaid
      ? 'Recibimos tu pago. El vendedor va a preparar y despachar tu pedido; este estado se actualiza cuando salga.'
      : 'Estamos esperando la confirmación del pago para preparar tu pedido.',
    'Estamos preparando tu pedido para despacharlo.',
    'Tu pedido ya fue despachado y está en camino.',
    'Tu pedido fue entregado. ¡Gracias por tu compra!'
  ][step];
  const address = selectedOrder?.shipping_address;
  const shortOrderId = selectedOrder ? selectedOrder.id.split('-')[0].toUpperCase() : '';
  const supportMessage = `Hola! Tengo un problema con mi pedido #${shortOrderId}: `;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] py-12 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-lg mb-8 text-center">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-2">Seguimiento</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Ingresá tu DNI para ver el estado de tus compras.</p>
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-6 sm:p-8 rounded-3xl shadow-xl">
        {!selectedOrder && orders.length === 0 && (
          <form onSubmit={handleSearch} className="space-y-4 mb-8">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">DNI / Documento</label>
              <input 
                required
                type="text" 
                placeholder="Ej: 35123456"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-black dark:focus:border-white transition font-mono dark:text-white"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              BUSCAR PEDIDOS
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in mb-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {/* Lista de multiples ordenes */}
        {orders.length > 0 && !selectedOrder && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">TUS ÚLTIMOS PEDIDOS:</h3>
            <div className="space-y-3">
              {orders.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className="w-full text-left bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 p-4 rounded-xl hover:border-black dark:hover:border-white transition group flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-500 transition-colors">#{o.id.split('-')[0]}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3"/> {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-black dark:text-white">${Number(o.total).toLocaleString('es-AR')}</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mt-1">{o.status}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setOrders([])} className="mt-6 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white uppercase tracking-widest text-center w-full transition">
              Volver a buscar
            </button>
          </div>
        )}

        {/* Detalle de una orden */}
        {selectedOrder && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {paymentReturn === 'success' && !isCanceled && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">¡Gracias por tu compra! Ya recibimos tu pedido.</p>
              </div>
            )}
            {paymentReturn === 'failure' && !isPaid && !isCanceled && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 mb-6">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">El pago no se completó. Tu pedido queda reservado unos minutos por si querés reintentar.</p>
              </div>
            )}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-black dark:text-white font-mono uppercase tracking-tight">#{selectedOrder.id.split('-')[0]}</h2>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
            </div>
            
            <div className="border-t border-zinc-200 dark:border-white/10 pt-8">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-6 text-center">
                Estado Actual: <span className="text-indigo-500 dark:text-indigo-400">{isConfirmingPayment ? 'Confirmando pago' : selectedOrder.status}</span>
              </h3>
              
              {isCanceled ? (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-500 font-bold">Este pedido fue cancelado.</p>
                </div>
              ) : (
                <div className="relative flex justify-between items-center px-2">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-200 dark:bg-zinc-800 -translate-y-1/2 z-0 rounded-full"></div>
                  
                  <div 
                    className="absolute top-1/2 left-0 h-1 bg-black dark:bg-white -translate-y-1/2 z-0 transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${((step - 1) / 3) * 100}%` }}
                  ></div>

                  {/* Paso 1: Pendiente */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${step >= 1 ? 'bg-black dark:bg-white text-white dark:text-black border-2 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-800'}`}>
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= 1 ? 'text-black dark:text-white' : 'text-zinc-400'}`}>Ordenado</span>
                  </div>

                  {/* Paso 2: Pagado/Preparando */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${step >= 2 ? 'bg-black dark:bg-white text-white dark:text-black border-2 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-800'}`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= 2 ? 'text-black dark:text-white' : 'text-zinc-400'}`}>Preparando</span>
                  </div>

                  {/* Paso 3: Enviado */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${step >= 3 ? 'bg-black dark:bg-white text-white dark:text-black border-2 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-800'}`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= 3 ? 'text-black dark:text-white' : 'text-zinc-400'}`}>Enviado</span>
                  </div>

                  {/* Paso 4: Entregado */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${step >= 4 ? 'bg-emerald-500 text-white border-2 border-transparent shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-800'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= 4 ? 'text-emerald-500' : 'text-zinc-400'}`}>Entregado</span>
                  </div>
                </div>
              )}
            </div>
            
            {!isCanceled && (
              <div className="mt-8 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
                  <p className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    Pago:
                    {isPaid ? (
                      <span className="font-bold text-emerald-500">Confirmado</span>
                    ) : isConfirmingPayment ? (
                      <span className="font-bold text-black dark:text-white flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirmando...</span>
                    ) : (
                      <span className="font-bold text-amber-500">Pendiente</span>
                    )}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">Envío: <span className="font-bold text-black dark:text-white">{shippingLabel}</span></p>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-3 pt-3 border-t border-zinc-200 dark:border-white/10">{nextStepMessage}</p>
              </div>
            )}

            {/* Detalle de la entrega */}
            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Entrega</h4>
              {address?.street ? (
                <p className="font-medium text-black dark:text-white leading-relaxed">
                  {address.street} {address.number}{address.apartment ? `, ${address.apartment}` : ''}<br />
                  {[address.city, address.state].filter(Boolean).join(', ')}{address.zip ? ` (CP ${address.zip})` : ''}
                </p>
              ) : (
                <p className="font-medium text-black dark:text-white">Retiro en local / a coordinar</p>
              )}
            </div>

            {/* Detalle de la compra */}
            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Tu compra</h4>
              <ul className="space-y-1.5">
                {(selectedOrder.items || []).map(item => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="text-black dark:text-white min-w-0">{item.quantity} × {item.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{formatMoney(lineTotal(item))}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between gap-3 mt-3 pt-3 border-t border-zinc-200 dark:border-white/10">
                <span className="text-zinc-500 dark:text-zinc-400">Total{selectedOrder.payment_method ? ` · ${selectedOrder.payment_method}` : ''}</span>
                <span className="font-bold text-black dark:text-white">${Number(selectedOrder.total).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Informar un problema */}
            <div className="mt-4 p-4 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
              <h4 className="font-bold text-black dark:text-white mb-1">¿Tuviste un problema con tu pedido?</h4>
              <p className="text-zinc-500 dark:text-zinc-400 mb-3">Escribinos con tu número de pedido y lo resolvemos.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(supportMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                {SUPPORT_EMAIL && (
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Problema con el pedido #${shortOrderId}`)}&body=${encodeURIComponent(supportMessage)}`}
                    className="flex-1 border border-zinc-200 dark:border-white/10 text-black dark:text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:border-black dark:hover:border-white transition"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
              </div>
            </div>

            <button onClick={() => { setSelectedOrder(null); setOrders([]); }} className="mt-6 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white uppercase tracking-widest text-center w-full transition">
              Volver a buscar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
