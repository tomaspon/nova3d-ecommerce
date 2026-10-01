import React, { useState, useEffect } from 'react';
import { Search, Loader2, Package, Truck, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function TrackingPage() {
  const [document, setDocument] = useState('');
  const [orders, setOrders] = useState([]); // Can be multiple if searching by DNI
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Auto-load si viene de Mercado Pago
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderIdParam = searchParams.get('order');

    if (orderIdParam) {
      fetchOrderByID(orderIdParam);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchOrderByID = async (id) => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .ilike('id', `${id}%`)
        .single();

      if (fetchError || !data) {
        throw new Error('No pudimos encontrar los detalles de este pedido.');
      }
      setSelectedOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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

  const getStatusStep = (status) => {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s.includes('pendiente')) return 1;
    if (s.includes('pagado') || s.includes('preparando')) return 2;
    if (s.includes('enviado') || s.includes('despachado')) return 3;
    if (s.includes('entregado')) return 4;
    return 0;
  };

  const step = selectedOrder ? getStatusStep(selectedOrder.status) : 0;
  const isCanceled = selectedOrder?.status.toLowerCase().includes('cancelado');

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
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-black dark:text-white font-mono uppercase tracking-tight">#{selectedOrder.id.split('-')[0]}</h2>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
            </div>
            
            <div className="border-t border-zinc-200 dark:border-white/10 pt-8">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-6 text-center">
                Estado Actual: <span className="text-indigo-500 dark:text-indigo-400">{selectedOrder.status}</span>
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
                      <Loader2 className="w-5 h-5" />
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
            
            <div className="mt-8 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl text-sm">
              <p className="text-zinc-500 dark:text-zinc-400">Total: <span className="font-bold text-black dark:text-white">${Number(selectedOrder.total).toLocaleString('es-AR')}</span></p>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">Dirección: <span className="font-medium text-black dark:text-white">{selectedOrder.shipping_address?.street} {selectedOrder.shipping_address?.number}</span></p>
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
