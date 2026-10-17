import React, { useState, useEffect } from 'react';
import { Search, Loader2, Package, Truck, CheckCircle2, AlertCircle, Calendar, ClipboardCheck, MapPin, MessageCircle, Mail, User, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../../storeContact';
import { isAwaitingPayment, isPaid as isOrderPaid, isCanceled as isOrderCanceled, trackingStep } from '../../orderStatus';
import { lineTotal, formatMoney } from '../../pricing';

// Etapas que ve el cliente, en el mismo orden que la barra de progreso del detalle
const TRACKING_STAGES = [
  { icon: ClipboardCheck, title: 'Ordenado', description: 'Recibimos tu pedido y confirmamos el pago.' },
  { icon: Package, title: 'Preparando', description: 'Armamos y embalamos tu compra.' },
  { icon: Truck, title: 'Enviado', description: 'Sale con el transportista. Acá vas a ver el código de seguimiento.' },
  { icon: CheckCircle2, title: 'Entregado', description: 'Llegó a destino. ¡Que lo disfrutes!' }
];

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
      // El id completo de la orden funciona como clave: solo lo tiene quien hizo la compra,
      // por eso este camino sí devuelve la dirección de entrega.
      const { data, error: fetchError } = await supabase.rpc('get_order_public', { p_order_id: id });

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
      // Por DNI la base devuelve solo estado, artículos y envío: sin dirección ni datos personales,
      // y con el número corto de pedido en lugar del id completo.
      const { data, error: fetchError } = await supabase.rpc('track_orders_by_document', { p_document: document.trim() });

      if (fetchError || !data || data.length === 0) {
        throw new Error('No encontramos pedidos asociados a este documento.');
      }

      const found = data.map(order => ({ ...order, id: order.short_id }));
      if (found.length === 1) {
        setSelectedOrder(found[0]);
      } else {
        setOrders(found);
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
  // La búsqueda por DNI no trae la dirección; el enlace de la compra sí
  const hasAddressData = selectedOrder ? 'shipping_address' in selectedOrder : false;
  const shippingCost = Number(selectedOrder?.shipping_cost) || 0;
  const shortOrderId = selectedOrder ? selectedOrder.id.split('-')[0].toUpperCase() : '';
  const supportMessage = `Hola! Tengo un problema con mi pedido #${shortOrderId}: `;

  // Pantalla de búsqueda: todavía no hay pedido ni lista. Si se entró con el enlace de la compra,
  // mientras carga se muestra el indicador en lugar del buscador.
  const isOpeningLink = isLoading && new URLSearchParams(window.location.search).has('order');
  const isSearching = !selectedOrder && orders.length === 0 && !isOpeningLink;

  if (isOpeningLink && !selectedOrder) {
    return (
      <div className="min-h-[60vh] bg-[#FAFAFA] dark:bg-[#121212] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="sr-only">Cargando tu pedido</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] py-10 sm:py-14 lg:py-16 px-4 sm:px-8 lg:px-12 flex flex-col items-center">
      {isSearching ? (
        /* ── Búsqueda: dos columnas en escritorio, apiladas en celular ── */
        // Mismo contenedor que el catálogo (max-w-screen-2xl + px-12): las páginas de la tienda
        // comparten bordes. Las dos columnas alineadas arriba.
        <div className="w-full max-w-screen-2xl lg:px-12 grid lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem] gap-12 lg:gap-20 xl:gap-28 items-start lg:pt-8 xl:pt-14">

          {/* Columna izquierda: título y buscador */}
          <section aria-labelledby="tracking-title">
            <h1 id="tracking-title" className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-zinc-900 dark:text-white tracking-tighter leading-[1.02] mb-6">
              ¿Dónde está<br />tu pedido?
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-base sm:text-lg max-w-md mb-10 lg:mb-12">
              Ingresá el DNI con el que hiciste la compra y te mostramos en qué etapa está.
            </p>

            <form onSubmit={handleSearch} className="max-w-2xl">
              <label htmlFor="tracking-document" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-2 block">
                DNI / Documento
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="tracking-document"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej: 35123456"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  aria-describedby={error ? 'tracking-error' : undefined}
                  className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/20 hover:border-zinc-400 dark:hover:border-white/30 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 transition text-zinc-900 dark:text-white placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="shrink-0 bg-black dark:bg-white text-white dark:text-black font-bold px-7 py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Buscar pedidos
                </button>
              </div>

              {error && (
                <div id="tracking-error" role="alert" className="mt-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
            </form>

            <div className="mt-8 space-y-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
              <p className="flex items-start gap-2.5">
                <User className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  ¿Compraste con tu cuenta?{' '}
                  <Link to="/perfil" className="inline-block py-1 font-bold text-zinc-900 dark:text-white underline underline-offset-4 hover:opacity-70">
                    Mirá todos tus pedidos en tu perfil
                  </Link>
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Por seguridad, la dirección solo se ve desde el enlace de tu compra.</span>
              </p>
            </div>
          </section>

          {/* Columna derecha: qué significa cada etapa y ayuda */}
          <aside aria-label="Cómo sigue tu pedido" className="space-y-4">
            {/* Etapas: información de contexto, por eso más compacta que el buscador */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-7">
              <h2 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-5">Cómo sigue tu pedido</h2>
              <ol className="space-y-4">
                {TRACKING_STAGES.map(({ title, description }, index) => (
                  <li key={title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="w-7 h-7 rounded-full border border-zinc-300 dark:border-white/20 flex items-center justify-center text-xs font-bold text-zinc-900 dark:text-white shrink-0">
                        {index + 1}
                      </span>
                      {index < TRACKING_STAGES.length - 1 && (
                        <span className="w-px flex-1 bg-zinc-200 dark:bg-white/10 mt-1.5 -mb-2.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{title}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Ayuda: acción secundaria, sin competir en peso con "Buscar pedidos" */}
            <div className="border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">¿Necesitás ayuda con tu compra?</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">Escribinos y te respondemos a la brevedad.</p>
              </div>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hola! Tengo una consulta sobre mi pedido.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 border border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-white/5 transition"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </aside>
        </div>
      ) : (
      <>
      <div className="w-full max-w-lg mb-8 text-center">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-2">Seguimiento</h1>
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-6 sm:p-8 rounded-3xl shadow-xl">
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in mb-4">
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
                  {selectedOrder.carrier && (
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Transportista: <span className="font-bold text-black dark:text-white">{selectedOrder.carrier}</span></p>
                  )}
                  {selectedOrder.tracking_code && (
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Código de seguimiento: <span className="font-bold font-mono text-black dark:text-white break-all">{selectedOrder.tracking_code}</span></p>
                  )}
                  <p className="text-zinc-500 dark:text-zinc-400 mt-3 pt-3 border-t border-zinc-200 dark:border-white/10">{nextStepMessage}</p>
              </div>
            )}

            {/* Detalle de la entrega */}
            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Entrega</h4>
              {!hasAddressData ? (
                <p className="text-zinc-500 dark:text-zinc-400">Por seguridad, la dirección de entrega se muestra solo desde el enlace de tu compra o en tu perfil.</p>
              ) : address?.street ? (
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
                {(selectedOrder.items || []).map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                    <span className="text-black dark:text-white min-w-0">{item.quantity} × {item.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{formatMoney(lineTotal(item))}</span>
                  </li>
                ))}
                {shippingCost > 0 && (
                  <li className="flex justify-between gap-3">
                    <span className="text-black dark:text-white">Envío</span>
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{formatMoney(shippingCost)}</span>
                  </li>
                )}
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

            <button onClick={() => { setSelectedOrder(null); setOrders([]); setError(''); }} className="mt-6 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white uppercase tracking-widest text-center w-full transition">
              Volver a buscar
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
