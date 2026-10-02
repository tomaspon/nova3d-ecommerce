import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { ChevronRight, User, TrendingUp, Package, ShoppingBag, DollarSign, X, Clock, CheckCircle2, CreditCard, AlertTriangle, ChevronDown } from 'lucide-react';

export default function DashboardPage() {
  const { products, updateOrderStatus } = useStore();
  const [orders, setOrders] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month, year
  
  const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [returnForm, setReturnForm] = useState({});
    const handleOpenReturn = (order) => {
    const initialForm = {};
    order.items.forEach(item => {
      initialForm[item.id] = { restock: 0, damaged: 0, lost: 0 };
    });
    setReturnForm(initialForm);
    setReturnModal(order);
    setSelectedOrder(null);
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const orderIdShort = returnModal.id.split('-')[0];

    try {
      for (const item of returnModal.items) {
        const formItem = returnForm[item.id];
        const originalProduct = products.find(p => p.id === item.id);
        
                if (formItem.restock > 0 && originalProduct) {
          const newStock = originalProduct.stock + formItem.restock;
          await supabase.from('products').update({stock: newStock}).eq('id', item.id);
          await supabase.from('inventory_logs').insert([{
            product_id: item.id,
            change_amount: formItem.restock,
            stock_after: newStock,
            reason: 'Devolución',
            note: `Reingreso por cancelación Orden #${orderIdShort}`
          }]);
          originalProduct.stock = newStock;
        }
        
        if (formItem.damaged > 0 && originalProduct) {
          await supabase.from('inventory_logs').insert([{
            product_id: item.id,
            change_amount: -formItem.damaged,
            stock_after: originalProduct.stock,
            reason: 'Dañado',
            note: `Devuelto dañado - Orden #${orderIdShort}`
          }]);
        }
        
        if (formItem.lost > 0 && originalProduct) {
          await supabase.from('inventory_logs').insert([{
            product_id: item.id,
            change_amount: -formItem.lost,
            stock_after: originalProduct.stock,
            reason: 'Perdido',
            note: `No devuelto - Orden #${orderIdShort}`
          }]);
        }
      }

      await supabase.from('orders').update({status: 'cancelado/devuelto'}).eq('id', returnModal.id);
      
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) setOrders(data);
      
      setReturnModal(null);
    } catch (error) {
      console.error(error);
      alert("Error procesando la devolución");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Orders
      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (ordersData) setOrders(ordersData);

      // 2. Fetch Inventory Logs (para mermas)
      const { data: logsData } = await supabase.from('inventory_logs').select('change_amount, reason, product_id, created_at');
      if (logsData) {
        setInventoryLogs(logsData);
      }
      setIsLoading(false);
    };
    
      if (products.length > 0) {
        fetchData();
        const interval = setInterval(() => {
          fetchData();
        }, 30000); // refresh every 30s
        return () => clearInterval(interval);
      }
 else {
      // Si products todavía no cargó, esperamos a que cargue
      supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({data}) => {
        if(data) setOrders(data);
        setIsLoading(false);
      });
    }
  }, [products]);

// Helper para filtrar por fecha
  const filterByDate = (items) => {
    if (timeFilter === 'all') return items;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return items.filter(item => {
      const itemDate = new Date(item.created_at);
      if (timeFilter === 'today') return itemDate >= startOfToday;
      if (timeFilter === 'week') {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return itemDate >= startOfWeek;
      }
      if (timeFilter === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return itemDate >= startOfMonth;
      }
      if (timeFilter === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return itemDate >= startOfYear;
      }
      return true;
    });
  };

  const filteredOrders = filterByDate(orders);
  const filteredLogs = filterByDate(inventoryLogs);

  // Cálculos Reales
  // Una venta cuenta como ingreso desde que se paga y sigue contando mientras avanza el envío.
  // Las reservas sin pagar y las canceladas no suman.
  const PAID_STATUSES = ['pagado', 'preparando', 'enviado', 'despachado', 'entregado'];
  const validOrders = filteredOrders.filter(o => PAID_STATUSES.some(s => (o.status || '').toLowerCase().startsWith(s)));
  const reservedOrdersCount = orders.filter(o => o.status === 'pagado (reserva)').length; // Always total, or filtered? Let's leave total for current status. Wait, the screenshot says "Pedidos (S/Stock) 0". If they want stats for a timeframe, maybe it's "orders placed that needed stock". We'll use filteredOrders for this.
  const totalRevenue = validOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const totalSalesCount = validOrders.length;
  const activeProductsCount = products.filter(p => p.is_active || p.isActive).length; // Keep global

  const mermas = filteredLogs.filter(log => log.reason === 'Dañado' || log.reason === 'Perdido' || log.reason === 'Dañado');
  const losses = mermas.reduce((sum, log) => {
    const prod = products.find(p => p.id === log.product_id);
    const price = prod ? prod.price : 0;
    return sum + (Math.abs(log.change_amount) * price);
  }, 0);
  return (
    
      <div className="space-y-8 animate-in fade-in duration-500 relative">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Resumen General</h1>
            <p className="text-zinc-400 text-sm">Métricas en tiempo real de tu negocio.</p>
          </div>
          
          {/* Time Filters */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 overflow-x-auto hide-scrollbar">
            {[
              { id: 'all', label: 'Histórico' },
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' }
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeFilter(tf.id)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg whitespace-nowrap transition-colors ${timeFilter === tf.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>


      {isLoading ? (
        <div className="text-zinc-500 animate-pulse">Calculando métricas...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Card: Ingresos */}
            <div className="bg-black border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition group-hover:bg-emerald-500/20"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" /> Real
                </span>
              </div>
              <div className="relative z-10">
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Ingresos Totales</h3>
                <div className="text-xl sm:text-2xl font-black text-white truncate">${totalRevenue.toLocaleString('es-AR')}</div>
              </div>
            </div>

            {/* Card: Ventas */}
            <div className="bg-black border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition group-hover:bg-indigo-500/20"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Pedidos Pagados</h3>
                <div className="text-xl sm:text-2xl font-black text-white truncate">{totalSalesCount}</div>
              </div>
            </div>

            {/* Card: Catálogo */}
            <div className="bg-black border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition group-hover:bg-amber-500/20"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Productos Activos</h3>
                <div className="text-xl sm:text-2xl font-black text-white truncate">{activeProductsCount}</div>
              </div>
            </div>

            {/* Card: Reservas / Backorders */}
            <div className="bg-black border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition group-hover:bg-blue-500/20"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Pedidos (S/Stock)</h3>
                <div className="text-xl sm:text-2xl font-black text-white truncate">{reservedOrdersCount}</div>
              </div>
            </div>

          </div>

          {/* Fila de Mermas / Trazabilidad */}
          <div className="bg-gradient-to-r from-red-950/40 to-black border border-red-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between group gap-4">
            <div>
              <h3 className="text-white font-bold mb-1 flex items-center gap-2">
                Mermas 
                <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Trazabilidad Automática
                </span>
              </h3>
              
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-red-400">-${losses.toLocaleString('es-AR')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actividad Reciente */}
      <div className="bg-black border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Últimos movimientos</h2>
        {validOrders.length === 0 ? (
          <p className="text-zinc-500 text-sm">Esperando tu primera venta...</p>
        ) : (
          <div className="space-y-2">
            {validOrders.slice(0, 5).map(order => {
                const items = order.items || [];
                const firstItem = items[0];
                const moreItemsCount = items.length - 1;
                
                return (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="flex justify-between items-center py-3 px-4 -mx-2 rounded-xl cursor-pointer hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {firstItem?.imageUrl ? (
                      <div className="relative">
                        <img src={firstItem.imageUrl} alt={firstItem.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                        {moreItemsCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-zinc-800 text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center border border-zinc-950">+{moreItemsCount}</div>
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-500 shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-white font-bold text-sm truncate max-w-[200px] group-hover:text-emerald-400 transition-colors">
                        {firstItem?.name || 'Venta'} {moreItemsCount > 0 ? `y ${moreItemsCount} más` : ''}
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>{order.customer_name}</span>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                        <span className="text-emerald-400 font-bold">{firstItem?.quantity || 1}x</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-black text-base">+ ${Number(order.total).toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              )
              })}
            </div>
          )}
        </div>

        {/* MODAL DE DETALLE DE COMPRA */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
            
            <div className="relative w-full max-w-xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              
              {/* Header del Modal */}
              <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Orden #{selectedOrder.id.split('-')[0]}</h2>
                    
                      {selectedOrder.status?.includes('cancelado') ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                          {selectedOrder.status}
                        </span>
                      ) : (
                        <div className="relative">
                          <button 
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                            className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-colors"
                          >
                            {selectedOrder.status === 'pendiente' || selectedOrder.status === 'reservado' ? 'Reservado' : selectedOrder.status}
                            <ChevronDown className={`w-3 h-3 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isStatusDropdownOpen && (
                            <div className="absolute top-full mt-2 left-0 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-in slide-in-from-top-2 duration-200">
                              {[
                                { value: 'reservado', label: 'Reservado' },
                                { value: 'pagado', label: 'Pagado' },
                                { value: 'preparando', label: 'Preparando' },
                                { value: 'enviado', label: 'Enviado' },
                                { value: 'entregado', label: 'Entregado' }
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={async () => {
                                    setIsStatusDropdownOpen(false);
                                    const res = await updateOrderStatus(selectedOrder, option.value);
                                    if (res.success) {
                                      setSelectedOrder({...selectedOrder, status: option.value});
                                      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
                                      if (ordersData) setOrders(ordersData);
                                    } else {
                                      alert("Error actualizando estado.");
                                    }
                                  }}
                                  className={`w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${selectedOrder.status === option.value || (selectedOrder.status === 'pendiente' && option.value === 'reservado') ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                  </div>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition text-zinc-400 hover:text-white">
                  X
                </button>
              </div>

              {/* Contenido del Modal (Scrollable) */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                
                {/* Bloque Info Logstica y Pago */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black border border-white/5 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                      <span className="text-xs uppercase tracking-widest font-bold">Envo a</span>
                    </div>
                    <div className="text-white text-sm font-medium">
                      {selectedOrder.shipping_address?.street} {selectedOrder.shipping_address?.number}
                      {selectedOrder.shipping_address?.apartment && `, Depto ${selectedOrder.shipping_address.apartment}`}
                      <br />
                      <span className="text-zinc-400">{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} ({selectedOrder.shipping_address?.zip})</span>
                    </div>
                  </div>
                  
                  <div className="bg-black border border-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <CreditCard className="w-4 h-4" /> <span className="text-xs uppercase tracking-widest font-bold">Método</span>
                  </div>
                  <div className="text-white text-sm font-medium">
                    MercadoPago / Tarjeta
                  </div>
                </div>
              </div>

              {/* Bloque Cliente */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Comprador</h4>
                <p className="text-white font-medium mb-1">{selectedOrder.customer_name}</p>
                <p className="text-zinc-400 text-sm">{selectedOrder.customer_email}</p>
              </div>

              {/* Bloque Artículos */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Artículos ({selectedOrder.items.reduce((sum, i) => sum + i.quantity, 0)})</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map(item => {
                    const hasDiscount = item.discount > 0;
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => window.open(`/producto/${item.id}`, '_blank')}
                        className="flex gap-4 items-center bg-black/50 hover:bg-white/10 p-3 rounded-xl border border-white/5 cursor-pointer transition-colors group"
                        title="Ver detalle del producto en nueva pestaña"
                      >
                        <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center p-1 overflow-hidden shrink-0">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" /> : <Package className="w-5 h-5 text-zinc-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-white group-hover:text-emerald-400 leading-tight transition-colors">{item.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {item.quantity} un. x ${Number(hasDiscount ? item.price * (1 - item.discount / 100) : item.price).toLocaleString('es-AR')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-400">
                            ${(item.quantity * (hasDiscount ? item.price * (1 - item.discount / 100) : item.price)).toLocaleString('es-AR')}
                          </div>
                          {hasDiscount && <div className="text-[10px] text-zinc-500 line-through">${(item.quantity * item.price).toLocaleString('es-AR')}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-white/10 bg-black flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <span className="text-sm text-zinc-400 font-bold uppercase tracking-widest block mb-1">Total Cobrado</span>
                <span className="text-2xl font-black text-emerald-400">${Number(selectedOrder.total).toLocaleString('es-AR')}</span>
              </div>
              {!selectedOrder.status?.includes('cancelado') && (
                <button 
                  onClick={() => handleCancelOrder(selectedOrder)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-6 py-3 rounded-xl font-bold transition w-full sm:w-auto"
                >
                  Gestionar Devolución / Cancelar
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
