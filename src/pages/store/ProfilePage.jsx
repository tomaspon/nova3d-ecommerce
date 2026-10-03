import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Package, Heart, LogOut, Settings, Save, Key, User, MapPin, Loader2, ChevronRight, Printer } from 'lucide-react';
import { printReceipt } from '../../printReceipt';
import { lineTotal, formatMoney } from '../../pricing';

const getStatusColor = (status) => {
  if (!status) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500';
  const s = status.toLowerCase();
  if (s.includes('cancelado')) return 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20';
  if (s.includes('pagado')) return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20';
  if (s.includes('pendiente')) return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20';
  return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700';
};

export default function ProfilePage() {
  
  const { user, products, favorites, toggleFavorite } = useStore();
  
  const [datosForm, setDatosForm] = React.useState({
    name: user?.user_metadata?.shipping?.name || '',
    phone: user?.user_metadata?.shipping?.phone || '',
    document: user?.user_metadata?.shipping?.document || '',
    address: {
      street: user?.user_metadata?.shipping?.address?.street || '',
      number: user?.user_metadata?.shipping?.address?.number || '',
      apartment: user?.user_metadata?.shipping?.address?.apartment || '',
      zip: user?.user_metadata?.shipping?.address?.zip || '',
      city: user?.user_metadata?.shipping?.address?.city || '',
      state: user?.user_metadata?.shipping?.address?.state || '',
    }
  });
  
  const [newPassword, setNewPassword] = React.useState('');
  const [isSavingDatos, setIsSavingDatos] = React.useState(false);
  const [datosSuccess, setDatosSuccess] = React.useState('');
  const [datosError, setDatosError] = React.useState('');

  const handleSaveDatos = async (e) => {
    e.preventDefault();
    setIsSavingDatos(true);
    setDatosSuccess('');
    setDatosError('');
    try {
      if (newPassword) {
        const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdErr) throw pwdErr;
      }
      
      const { error: dataErr } = await supabase.auth.updateUser({
        data: { shipping: datosForm }
      });
      if (dataErr) throw dataErr;
      
      setNewPassword('');
      setDatosSuccess('Datos actualizados correctamente.');
    } catch (err) {
      setDatosError(err.message);
    } finally {
      setIsSavingDatos(false);
    }
  };

  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['orders', 'favorites', 'datos'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      // Pedidos hechos con el email de la cuenta, o con el DNI guardado en "Mis Datos"
      // (cubre compras donde se escribió otro email en el formulario)
      const savedDocument = String(user.user_metadata?.shipping?.document || '').replace(/["\\,()]/g, '').trim();
      let query = supabase.from('orders').select('*');
      query = savedDocument
        ? query.or(`customer_email.eq."${user.email}",customer_document.eq."${savedDocument}"`)
        : query.eq('customer_email', user.email);
      const { data } = await query.order('created_at', { ascending: false });

      if (data) setOrders(data);
      setIsLoading(false);
    };

    fetchOrders();
  }, [user, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!user) return null;

  
  const handlePrintReceipt = (order) => printReceipt(order);

  const favoriteProducts = (products || []).filter(p => (favorites || []).includes(p.id));

    return (
    <div className="bg-zinc-50 dark:bg-[#050505] min-h-[calc(100vh-6rem)] py-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        
        
        {/* ENCABEZADO MINIMALISTA */}
        <div className="relative mb-10 flex flex-col items-center border-b border-zinc-200 dark:border-white/10 pb-6 pt-4">
          
          {/* Botón Salir flotante (arriba a la derecha) */}
          <button 
            onClick={handleLogout}
            className="absolute top-4 right-0 text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
          >
            Salir <LogOut className="w-3.5 h-3.5" />
          </button>
          
          {/* Avatar & Info */}
          <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-100 dark:to-white rounded-full flex items-center justify-center text-white dark:text-black font-black text-3xl shadow-lg mb-4">
            {user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-1">Mi Perfil</h2>
          <p className="text-xs text-zinc-500 font-medium">{user?.email || ''}</p>
        </div>

        {/* NAVEGACIÓN (Subrayada tipo iOS) */}
        <div className="flex items-center justify-between md:justify-start gap-0 md:gap-8 border-b border-zinc-200 dark:border-white/5 mb-8">
          <button 
            onClick={() => setActiveTab('orders')} 
            className={`flex-1 md:flex-none text-center py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-black text-black dark:border-white dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('favorites')} 
            className={`flex-1 md:flex-none text-center py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'favorites' ? 'border-black text-black dark:border-white dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            Favoritos
          </button>
          <button 
            onClick={() => setActiveTab('datos')} 
            className={`flex-1 md:flex-none text-center py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'datos' ? 'border-black text-black dark:border-white dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            Mis Datos
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}

        <div className="w-full">

          {activeTab === 'orders' && (
            <div className="">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 tracking-tight">Historial de Pedidos</h1>
              
              {isLoading ? (
                <div className="flex items-center gap-3 px-2 py-8"><div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-500 dark:border-zinc-800 dark:border-t-zinc-400 rounded-full animate-spin"></div><span className="text-zinc-400 font-bold animate-pulse">Cargando tus pedidos...</span></div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center">
                  <Package className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mb-6" />
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Aún no compraste nada</h3>
                  <p className="text-zinc-500 mb-8 max-w-sm">Tu historial de pedidos aparecerá acá una vez que hagas tu primera compra en la tienda.</p>
                  <button onClick={() => navigate('/')} className="bg-black dark:bg-white text-white dark:text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform shadow-lg">
                    Ir a la tienda
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {(orders || []).map(order => (
                    <div key={order.id} className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      
                      {/* Cabecera del Pedido */}
                      <div className="bg-zinc-50/50 dark:bg-white/[0.02] px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-widest ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <span className="text-zinc-500 text-xs font-medium bg-white dark:bg-black px-3 py-1.5 rounded-md border border-zinc-200 dark:border-white/10 shadow-sm">
                            {new Date(order?.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs font-mono px-2 hidden sm:block">#{order?.id?.split('-')?.[0] || '...'}</span>
                        </div>
                        
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-sm flex flex-col sm:items-end">
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-0.5">Total Pagado</span>
                              <span className="font-black text-zinc-900 dark:text-white text-lg leading-none">${Number(order?.total || 0).toLocaleString('es-AR')}</span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handlePrintReceipt(order); }}
                              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 shadow-sm hover:scale-105"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Comprobante
                            </button>
                          </div>
                      </div>

                      {/* Lista de Items */}
                      <div className="p-6 flex flex-col gap-4">
                        {(order?.items || []).map(item => (
                          <div key={item.id} onClick={() => navigate(`/producto/${item.id}`)} className="flex items-center gap-5 cursor-pointer group p-3 -mx-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-white/5 group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors shrink-0">
                              {item.imageUrl ? (
                                <img loading="lazy" decoding="async" src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <Package className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate pr-4">{item.name}</h4>
                              <p className="text-xs text-zinc-500 mt-1 font-medium">{item.quantity} unidad{item.quantity > 1 ? 'es' : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-black text-zinc-900 dark:text-white">{formatMoney(lineTotal(item))}</div>
                              {item.quantity > 1 && <div className="text-[10px] text-zinc-400 font-medium mt-0.5">${Number(item.price).toLocaleString('es-AR')} c/u</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          
            {activeTab === 'datos' && (
              <div className="">
                <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 tracking-tight">Mis Datos</h1>
                
                <form onSubmit={handleSaveDatos} className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-white/5 rounded-[2rem] p-8 shadow-sm space-y-8">
                  {datosSuccess && <div className="bg-green-50 text-green-700 p-4 rounded-xl font-bold text-sm border border-green-100">{datosSuccess}</div>}
                  {datosError && <div className="bg-red-50 text-red-700 p-4 rounded-xl font-bold text-sm border border-red-100">{datosError}</div>}
                  
                  {/* Password Change */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Key className="w-4 h-4" /> Seguridad</h3>
                    <div className="space-y-3">
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña (dejar en blanco para no cambiar)" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                    </div>
                  </div>

                  {/* Personal Data */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Datos Personales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" value={datosForm.name} onChange={e => setDatosForm({...datosForm, name: e.target.value})} placeholder="Nombre Completo" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                      <input type="text" value={datosForm.document} onChange={e => setDatosForm({...datosForm, document: e.target.value})} placeholder="DNI / Documento" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                      <input type="tel" value={datosForm.phone} onChange={e => setDatosForm({...datosForm, phone: e.target.value})} placeholder="Teléfono" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-sm md:col-span-2" />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Dirección de Envío Predeterminada</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <input type="text" value={datosForm.address.street} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, street: e.target.value}})} placeholder="Calle" className="col-span-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                        <input type="text" value={datosForm.address.number} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, number: e.target.value}})} placeholder="Número" className="col-span-1 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={datosForm.address.apartment} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, apartment: e.target.value}})} placeholder="Depto / Piso (Opcional)" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                        <input type="text" value={datosForm.address.zip} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, zip: e.target.value}})} placeholder="Código Postal" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={datosForm.address.city} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, city: e.target.value}})} placeholder="Ciudad" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                        <input type="text" value={datosForm.address.state} onChange={e => setDatosForm({...datosForm, address: {...datosForm.address, state: e.target.value}})} placeholder="Provincia" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-base" />
                      </div>
                    </div>
                  </div>

                  <button disabled={isSavingDatos} type="submit" className="w-full bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70">
                    {isSavingDatos ? <><Loader2 className="w-5 h-5 animate-spin"/> Guardando...</> : <><Save className="w-5 h-5"/> Guardar Cambios</>}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'favorites' && (
            <div className="">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 tracking-tight">Tus Favoritos</h1>
              
              {favoriteProducts.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center">
                  <Heart className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mb-6" />
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-3">No tenés favoritos</h3>
                  <p className="text-zinc-500 mb-8 max-w-sm">Marcá el corazón en los productos que te gusten para guardarlos acá.</p>
                  <button onClick={() => navigate('/')} className="bg-black dark:bg-white text-white dark:text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform shadow-lg">
                    Explorar Catálogo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                  {favoriteProducts.map(p => {
                    const finalPrice = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
                    return (
                      <div key={p.id} className="flex flex-col group cursor-pointer" onClick={() => navigate(`/producto/${p.id}`)}>
                        <div className="aspect-[4/5] bg-zinc-100 dark:bg-zinc-900 rounded-3xl relative overflow-hidden mb-5 border border-zinc-200 dark:border-white/5">
                          {p.imageUrl ? (
                            <img loading="lazy" decoding="async" src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-black/20"><span className="text-zinc-300 text-xs font-bold uppercase tracking-widest">Sin foto</span></div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/90 dark:bg-black/50 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-full flex items-center justify-center text-red-500 hover:scale-110 transition-transform shadow-sm"
                            title="Quitar de favoritos"
                          >
                            <Heart className="w-5 h-5 fill-red-500" />
                          </button>
                        </div>
                        <div className="px-2">
                          <h3 className="font-bold text-zinc-900 dark:text-white text-base leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{p.name}</h3>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-black text-zinc-900 dark:text-white">${finalPrice.toLocaleString('es-AR')}</span>
                            {p.discount > 0 && (
                              <span className="text-xs text-zinc-400 dark:text-zinc-500 line-through">${p.price.toLocaleString('es-AR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
