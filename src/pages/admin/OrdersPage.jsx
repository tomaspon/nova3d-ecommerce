import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { Search, Package, Clock, CheckCircle2, ChevronDown, ChevronUp, User, SearchX, Calendar, X } from 'lucide-react';

const OrderStatusDropdown = ({ order, updateOrderStatus, onUpdated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isPending = order.status === 'pendiente' || order.status === 'reservado';
  const currentLabel = isPending ? 'Reservado' : order.status;

  const handleUpdate = async (e, newValue) => {
    e.stopPropagation();
    setIsOpen(false);
    if (order.status === newValue) return;
    
    const res = await updateOrderStatus(order, newValue);
    if (res.success) {
      if (onUpdated) onUpdated();
    } else {
      alert("Error actualizando estado.");
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-colors"
      >
        {currentLabel}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div className="absolute top-full mt-1 right-0 w-36 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-in slide-in-from-top-2 duration-200">
            {[
              { value: 'reservado', label: 'Reservado' },
              { value: 'pagado', label: 'Pagado' },
              { value: 'preparando', label: 'Preparando' },
              { value: 'enviado', label: 'Enviado' },
              { value: 'entregado', label: 'Entregado' },
              { value: 'cancelado', label: 'Cancelado' }
            ].map((option) => {
              const isActive = order.status === option.value || (isPending && option.value === 'reservado');
              return (
                <button
                  key={option.value}
                  onClick={(e) => handleUpdate(e, option.value)}
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default function OrdersPage() {
  const { products, updateOrderStatus } = useStore();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

    const handleCancelOrder = async (order) => {
    const action = window.prompt(
      `Estás por CANCELAR la orden #${order.id.split('-')[0]}.\n\n` + 
      "¿Qué querés hacer con los productos de esta orden?\n\n" +
      "Opciones:\n" +
      "1 - Volver a sumarlos al inventario (El producto nunca salió o volvió en perfecto estado)\n" +
      "2 - No sumarlos (El producto se rompió, se perdió, o no se recuperó el stock)\n\n" +
      "Ingresá el número 1 o 2:"
    );

    if (action === null) return;

    if (action !== '1' && action !== '2') {
      alert("Operación cancelada: Debés ingresar 1 o 2.");
      return;
    }

    try {
      for (const item of order.items) {
        const originalProduct = products.find(p => p.id === item.id);
        if (originalProduct) {
           if (action === '1') {
              const newStock = originalProduct.stock + item.quantity;
              await supabase.from('products').update({stock: newStock}).eq('id', item.id);
              await supabase.from('inventory_logs').insert([{
                product_id: item.id,
                change_amount: item.quantity,
                stock_after: newStock,
                reason: 'Devolución',
                note: `Cancelación Orden #${order.id.split('-')[0]} (Retorno al stock)`
              }]);
           } else {
              // El stock ya fue restado al comprar. Solo registramos la merma financiera.
              await supabase.from('inventory_logs').insert([{
                product_id: item.id,
                change_amount: 0,
                stock_after: originalProduct.stock,
                reason: 'Perdido',
                note: `Cancelación Orden #${order.id.split('-')[0]} (No retornó al stock)`
              }]);
           }
        }
      }

      await supabase.from('orders').update({status: 'cancelado'}).eq('id', order.id);
      
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) setOrders(data);

      alert("Orden cancelada exitosamente.");
    } catch (error) {
      console.error(error);
      alert("Error procesando la cancelación.");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const toggleExpand = (id) => {
    if (expandedOrderId === id) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(id);
    }
  };

  // Filtrado Compuesto (Texto + Fecha)
  const filteredOrders = orders.filter(order => {
    const q = searchQuery.toLowerCase();
    const shortId = order.id.split('-')[0].toLowerCase();
    
    // Coincidencia de texto
    const matchText = order.customer_name.toLowerCase().includes(q) ||
                      order.customer_email.toLowerCase().includes(q) ||
                      shortId.includes(q);
                      
    // Coincidencia de fecha
    let matchDate = true;
    if (dateFilter) {
      // Convertir la fecha de la base de datos (UTC) a "YYYY-MM-DD"
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      matchDate = orderDate === dateFilter;
    }

    return matchText && matchDate;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 tracking-tight">Pedidos</h1>
          <p className="text-zinc-400 text-sm">Gestioná las ventas y envíos de tu tienda.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-bold text-white">{orders.length} Totales</span>
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-black border border-white/10 rounded-2xl p-3 flex flex-row gap-2">
        
        {/* Buscador de Texto */}
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

        {/* Filtro por Fecha Exacta */}
        <div className="relative flex items-center gap-1.5 w-[130px] shrink-0">
          <div className="relative w-full overflow-hidden rounded-xl">
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
              className="p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
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
            <Package className="w-5 h-5 text-indigo-400" />
            Ventas Registradas
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
                <Package className="w-12 h-12 opacity-20 mb-4" />
                Aún no hay ventas registradas.
              </>
            )}
          </div>
        ) : (
          <div className="">
            {filteredOrders.map(order => {
              const date = new Date(order.created_at).toLocaleDateString('es-AR', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              
              const items = order.items || [];
              const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
              const isExpanded = expandedOrderId === order.id;

              return (
                                  <div key={order.id} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex flex-col hover:bg-white/[0.02] transition-colors mb-4 cursor-pointer group" onClick={() => toggleExpand(order.id)}>
                    
                    {/* Top Row: Avatar, Name & Status */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="font-bold text-white text-base truncate max-w-full">{order.customer_name}</span>
                          {order.status?.includes('cancelado') ? (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                              {order.status}
                            </span>
                          ) : (
                            <OrderStatusDropdown order={order} updateOrderStatus={updateOrderStatus} onUpdated={fetchOrders} />
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 truncate max-w-full">{order.customer_email}</div>
                      </div>
                    </div>

                    {/* Mid Row: Meta info */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-zinc-500 font-mono bg-white/5 rounded-lg p-2.5 mb-4">
                      <span>{date}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-zinc-300 font-bold">ID: {order.id.split('-')[0]}</span>
                    </div>

                    {/* Bottom Row: Pricing & Actions */}
                    <div className="flex items-center justify-between mt-auto border-t border-white/5 pt-4">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Total ({totalItems} prod)</div>
                        <div className="text-lg font-black text-emerald-400">${Number(order.total).toFixed(0)}</div>
                      </div>
                      
                      <button className="p-2 text-zinc-500 group-hover:text-white transition">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {isExpanded && (
                    <div className="-mx-4 -mb-4 mt-4 p-4 bg-black/40 border-t border-white/5 rounded-b-2xl animate-in slide-in-from-top-2 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* Info del Cliente y Logística */}
                        <div>
                          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Información del Cliente</h3>
                          <div className="space-y-2 mb-6">
                            <p className="text-sm text-zinc-300"><span className="font-bold text-white">Nombre:</span> {order.customer_name}</p>
                            {order.customer_document && <p className="text-sm text-zinc-300"><span className="font-bold text-white">Documento:</span> {order.customer_document}</p>}
                            <p className="text-sm text-zinc-300"><span className="font-bold text-white">Email:</span> {order.customer_email}</p>
                            {order.customer_phone && <p className="text-sm text-zinc-300"><span className="font-bold text-white">Teléfono:</span> {order.customer_phone}</p>}
                            {order.payment_method && <p className="text-sm text-zinc-300"><span className="font-bold text-white">Pago:</span> <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-bold">{order.payment_method}</span></p>}
                            <p className="text-sm text-zinc-300"><span className="font-bold text-white">ID Completo:</span> <span className="font-mono text-xs break-all">{order.id}</span></p>
                          </div>
                          
                          {order.shipping_address && (
                            <div className="mb-6">
                              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 mt-2">Dirección de Envío</h3>
                              <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1">
                                <p className="text-sm font-bold text-white">{order.shipping_address.street} {order.shipping_address.number}</p>
                                <p className="text-xs text-zinc-400">{order.shipping_address.city}, CP: {order.shipping_address.zip}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Acciones Operativas</p>
                            <p className="text-sm text-zinc-400 mb-3">La logística y despachos aún no están automatizados. Por ahora, contactá al cliente por email.</p>
                            <a href={`mailto:${order.customer_email}`} className="text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors inline-block">
                              Enviar Email al Cliente
                            </a>
                          </div>
                        </div>

                        {/* Desglose de Productos */}
                        <div>
                          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Artículos Comprados</h3>
                          <div className="space-y-3 bg-black/50 border border-white/5 p-4 rounded-xl">
                            {items.map(item => (
                              <a href={`/producto/${item.id}`} target="_blank" rel="noopener noreferrer" key={item.id} className="group flex items-center gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0 hover:bg-white/[0.02] transition p-2 rounded-lg -mx-2 cursor-pointer">
                                <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                                  {item.imageUrl ? (
                                    <img loading="lazy" decoding="async" src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <Package className="w-5 h-5 text-zinc-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold text-sm text-white group-hover:text-indigo-400 transition">{item.name}</div>
                                  <div className="text-xs text-zinc-400">ID: {item.id.split('-')[0]}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-zinc-400">{item.quantity}x ${Number(item.price).toLocaleString('es-AR')}</div>
                                  <div className="font-bold text-emerald-400 text-sm">${(item.quantity * item.price).toLocaleString('es-AR')}</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
