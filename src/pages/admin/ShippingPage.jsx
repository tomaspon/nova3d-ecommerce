import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { Search, Truck, Clock, CheckCircle2, User, SearchX, Calendar, X, Printer } from 'lucide-react';
import { printReceipt } from '../../printReceipt';
import { lineTotal, formatMoney } from '../../pricing';

export default function ShippingPage() {
  const { updateOrderStatus } = useStore();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pendientes');
  const [confirmOrder, setConfirmOrder] = useState(null);

      const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const statuses = activeTab === 'pendientes' ? ['pagado', 'preparando'] : ['enviado'];
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .in('status', statuses)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetchOrders();
    }, [activeTab]);

  const handlePrintReceipt = (order) => printReceipt(order, { showCustomerDetails: true });

  const filteredOrders = orders.filter(order => {
    const q = searchQuery.toLowerCase();
    const shortId = order.id.split('-')[0].toLowerCase();
    
    const matchText = order.customer_name.toLowerCase().includes(q) ||
                      order.customer_email.toLowerCase().includes(q) ||
                      shortId.includes(q);
                      
    let matchDate = true;
    if (dateFilter) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      matchDate = orderDate === dateFilter;
    }

    return matchText && matchDate;
  });

  return (
    <div className="space-y-6">
      {/* Header - SHIPPING */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Centro de Despacho</h1>
          </div>
          <p className="text-zinc-500 text-sm pl-12">Solo pedidos pagados, listos para armar y enviar.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-sm font-bold text-indigo-300">{orders.length} Para despachar</span>
          </div>
        </div>
      </div>

      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('pendientes')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'pendientes' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}
        >
          Cola de Despachos
        </button>
        <button 
          onClick={() => setActiveTab('despachados')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'despachados' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}
        >
          Historial Enviados
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-black border border-white/10 rounded-2xl p-3 flex flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Buscar pedido, cliente..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0 text-ellipsis bg-white/5 border border-white/10 text-white rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>

        <div className="relative flex items-center gap-1.5 w-[130px] shrink-0">
          <div className="relative w-full">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full min-w-0 bg-white/5 border border-white/10 text-zinc-300 rounded-xl py-2 pl-8 pr-1 focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-xs"
            />
          </div>
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              className="p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors shrink-0"
              title="Limpiar fecha"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" />
            Cola de Despachos
          </h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-zinc-500">Cargando pedidos...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            {searchQuery ? (
              <>
                <SearchX className="w-12 h-12 opacity-20 mb-4" />
                No se encontraron pedidos para "{searchQuery}".
              </>
            ) : (
              <>
                <Truck className="w-12 h-12 opacity-20 mb-4" />
                No hay paquetes para despachar.
              </>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {filteredOrders.map(order => {
              const date = new Date(order.created_at).toLocaleDateString('es-AR', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              
              const items = order.items || [];
              const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

              return (
                <div key={order.id} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Izquierda: Cliente & Envío */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <div className="text-white font-bold text-lg">{order.customer_name}</div>
                          <div className="text-xs text-zinc-400">ID Orden: <span className="font-mono text-zinc-300">{order.id.split('-')[0]}</span> • {date}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Contacto</div>
                          <div className="text-zinc-300">{order.customer_email}</div>
                          {order.customer_phone && <div className="text-zinc-300">{order.customer_phone}</div>}
                          {order.customer_document && <div className="text-zinc-300">DNI: {order.customer_document}</div>}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Entrega</div>
                          {order.shipping_address ? (
                            <div className="text-zinc-300 leading-snug">
                              {order.shipping_address.street} {order.shipping_address.number}<br/>
                              {order.shipping_address.city}, {order.shipping_address.state}<br/>
                              (CP: {order.shipping_address.zip})
                            </div>
                          ) : (
                            <div className="text-indigo-400 font-bold">Retiro en local</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Derecha: Artículos */}
                    <div className="flex-1 bg-black/50 border border-white/5 rounded-xl p-4 flex flex-col">
                      <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">Artículos Comprados ({totalItems})</div>
                      <div className="flex-1 space-y-2 overflow-y-auto max-h-32 pr-2 custom-scrollbar">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between items-start text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div className="flex gap-2">
                              <span className="text-zinc-500 font-mono mt-0.5">{item.quantity}x</span>
                              <span className="text-zinc-300 leading-tight pr-2">{item.name}</span>
                            </div>
                            <div className="text-emerald-400 font-medium shrink-0">{formatMoney(lineTotal(item))}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                        <div className="text-xs text-zinc-500">Pago: {order.payment_method || 'MercadoPago'}</div>
                        <div className="text-white font-bold text-lg">${Number(order.total).toLocaleString('es-AR')}</div>
                      </div>
                    </div>

                  </div>

                  {/* Footer: Acciones */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrintReceipt(order); }}
                      className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2.5 rounded-lg border border-indigo-500/20"
                    >
                      <Printer className="w-4 h-4" /> Comprobante
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmOrder(order); }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                      <Truck className="w-4 h-4" /> Confirmar Despacho
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmación Personalizado */}
      {confirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setConfirmOrder(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Confirmar Despacho</h3>
            </div>
            
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              ¿Estás seguro que querés marcar el pedido de <strong className="text-white">{confirmOrder.customer_name}</strong> como enviado? Esta acción moverá el pedido al historial.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmOrder(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const orderToProcess = confirmOrder;
                  setConfirmOrder(null); // close modal immediately
                  const res = await updateOrderStatus(orderToProcess, 'enviado');
                  if (res.success) fetchOrders();
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-colors flex items-center gap-2"
              >
                Sí, Despachar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
