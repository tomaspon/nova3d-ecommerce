import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Heart, LogOut, Save, Key, User, MapPin, Loader2, ChevronRight, Printer, Truck, CheckCircle2, Clock, XCircle, PackageCheck, RotateCcw } from 'lucide-react';
import { printReceipt } from '../../printReceipt';
import { unitPrice, lineTotal, formatMoney } from '../../pricing';
import { isAwaitingPayment, isCanceled, isPaid, trackingStep } from '../../orderStatus';

const TABS = [
  { id: 'orders', label: 'Pedidos', icon: Package },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
  { id: 'datos', label: 'Mis datos', icon: User }
];

const ORDER_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'En curso' },
  { id: 'done', label: 'Entregados' },
  { id: 'canceled', label: 'Cancelados' }
];

const TRACKING_STEPS = ['Pagado', 'Preparando', 'Enviado', 'Entregado'];

// Cómo se le cuenta al cliente cada estado: título claro, una línea de contexto y un color.
function describeStatus(order) {
  const status = order.status;
  if (isCanceled(status)) {
    const expired = (status || '').toLowerCase().includes('tiempo');
    return {
      icon: XCircle, tone: 'red', title: 'Cancelado',
      text: expired ? 'Venció el tiempo para pagar. No se te cobró nada.' : 'Este pedido fue cancelado.'
    };
  }
  if (isAwaitingPayment(status)) {
    return { icon: Clock, tone: 'amber', title: 'Esperando el pago', text: 'Cuando se acredite el pago empezamos a prepararlo.' };
  }
  const step = trackingStep(status);
  if (step === 4) return { icon: PackageCheck, tone: 'emerald', title: 'Entregado', text: '¡Que lo disfrutes!' };
  if (step === 3) return { icon: Truck, tone: 'sky', title: 'En camino', text: order.carrier ? `Lo lleva ${order.carrier}.` : 'Tu pedido ya salió.' };
  if (step === 2) return { icon: Package, tone: 'sky', title: 'Preparando tu pedido', text: 'Lo estamos empaquetando.' };
  return { icon: CheckCircle2, tone: 'emerald', title: 'Pago confirmado', text: 'En breve empezamos a prepararlo.' };
}

const TONES = {
  red: 'text-red-600 dark:text-red-400 bg-red-500/10',
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  sky: 'text-sky-600 dark:text-sky-400 bg-sky-500/10'
};

function matchesFilter(order, filter) {
  if (filter === 'canceled') return isCanceled(order.status);
  if (filter === 'done') return trackingStep(order.status) === 4 && isPaid(order.status);
  if (filter === 'active') return !isCanceled(order.status) && !(isPaid(order.status) && trackingStep(order.status) === 4);
  return true;
}

const inputClass = 'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-base text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition';

function Field({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

function OrderCard({ order, onTrack, onReceipt, onReorder, onOpenProduct }) {
  const items = order.items || [];
  const status = describeStatus(order);
  const StatusIcon = status.icon;
  const canceled = isCanceled(order.status);
  const showProgress = isPaid(order.status);
  const step = trackingStep(order.status);
  const date = new Date(order.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <article className="bg-white dark:bg-[#0c0c0c] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Resumen del pedido */}
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(3,auto)_1fr] gap-x-8 gap-y-3 px-5 sm:px-6 py-4 bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/10 text-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fecha</p>
          <p className="mt-0.5 font-medium text-zinc-900 dark:text-white">{date}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{isPaid(order.status) ? 'Total pagado' : 'Total'}</p>
          <p className="mt-0.5 font-bold text-zinc-900 dark:text-white">{formatMoney(order.total)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Pedido</p>
          <p className="mt-0.5 font-mono text-zinc-900 dark:text-white">#{order.id.split('-')[0]}</p>
        </div>
        <div className="flex items-center sm:justify-end">
          <button
            type="button"
            onClick={() => onReceipt(order)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline-offset-4 hover:underline"
          >
            <Printer className="w-4 h-4" /> Comprobante
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5">
        {/* Estado */}
        <div className="flex items-start gap-3">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${TONES[status.tone]}`}>
            <StatusIcon className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">{status.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{status.text}</p>
          </div>
        </div>

        {showProgress && (
          <div className="mt-5" aria-label={`Etapa ${step} de 4`}>
            <div className="grid grid-cols-4 gap-1.5">
              {TRACKING_STEPS.map((label, index) => (
                <div key={label}>
                  <div className={`h-1.5 rounded-full ${index < step ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-white/10'}`} />
                  <p className={`mt-2 text-[11px] font-medium hidden sm:block ${index < step ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600'}`}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Productos */}
        <ul className="mt-5 divide-y divide-zinc-100 dark:divide-white/5 border-t border-zinc-100 dark:border-white/5">
          {items.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenProduct(item.id)}
                className="w-full flex items-center gap-4 py-4 text-left group"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {item.imageUrl ? (
                    <img loading="lazy" decoding="async" src={item.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <Package className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-white truncate group-hover:underline underline-offset-4">{item.name}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {item.quantity} × {formatMoney(unitPrice(item))}
                  </p>
                </div>
                <p className="font-semibold text-zinc-900 dark:text-white shrink-0">{formatMoney(lineTotal(item))}</p>
              </button>
            </li>
          ))}
        </ul>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-zinc-100 dark:border-white/5">
          {canceled ? (
            <button
              type="button"
              onClick={() => onReorder(order)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold px-5 py-2.5 hover:opacity-85 transition"
            >
              <RotateCcw className="w-4 h-4" /> Volver a comprar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTrack(order)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold px-5 py-2.5 hover:opacity-85 transition"
            >
              <Truck className="w-4 h-4" /> Seguir pedido
            </button>
          )}
          <Link
            to="/seguimiento"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white text-sm font-semibold px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/5 transition"
          >
            Ayuda con este pedido
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function ProfilePage() {
  const { user, products, favorites, toggleFavorite } = useStore();
  const navigate = useNavigate();

  const shipping = user?.user_metadata?.shipping || {};
  const [datosForm, setDatosForm] = useState({
    name: shipping.name || '',
    phone: shipping.phone || '',
    document: shipping.document || '',
    address: {
      street: shipping.address?.street || '',
      number: shipping.address?.number || '',
      apartment: shipping.address?.apartment || '',
      zip: shipping.address?.zip || '',
      city: shipping.address?.city || '',
      state: shipping.address?.state || ''
    }
  });

  const [newPassword, setNewPassword] = useState('');
  const [isSavingDatos, setIsSavingDatos] = useState(false);
  const [datosSuccess, setDatosSuccess] = useState('');
  const [datosError, setDatosError] = useState('');

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(t => t.id === tab) ? tab : 'orders';
  });
  const [orderFilter, setOrderFilter] = useState('all');

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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      // Pedidos de la cuenta: los que se hicieron con la sesión iniciada (user_id)
      // o con el mismo email. Son los mismos que la base permite leer a este usuario.
      const { data } = await supabase
        .from('orders')
        .select('*')
        .or(`user_id.eq.${user.id},customer_email.eq."${user.email}"`)
        .order('created_at', { ascending: false });

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

  const setAddress = (field, value) => setDatosForm({ ...datosForm, address: { ...datosForm.address, [field]: value } });

  const favoriteProducts = (products || []).filter(p => (favorites || []).includes(p.id));
  const visibleOrders = orders.filter(order => matchesFilter(order, orderFilter));
  const displayName = datosForm.name.trim() || user.email.split('@')[0];
  const counts = { orders: orders.length, favorites: favoriteProducts.length };

  const handleReorder = (order) => {
    const first = (order.items || [])[0];
    navigate(first ? `/producto/${first.id}` : '/');
  };

  return (
    <div className="bg-zinc-50 dark:bg-[#050505] min-h-[calc(100vh-6rem)] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8 lg:gap-12">

        {/* Lateral: cuenta + navegación */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-lg shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-zinc-900 dark:text-white truncate capitalize">{displayName}</p>
              <p className="text-sm text-zinc-500 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="lg:hidden p-2 -mr-2 text-zinc-500 hover:text-red-600"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <nav className="mt-6 flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 border-b lg:border-b-0 border-zinc-200 dark:border-white/10" aria-label="Secciones de la cuenta">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 flex items-center gap-3 text-sm font-semibold transition
                    px-1 py-3 mr-5 border-b-2 lg:mr-0 lg:border-b-0 lg:px-3 lg:py-2.5 lg:rounded-xl
                    ${active
                      ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white lg:bg-white lg:dark:bg-white/10 lg:shadow-sm'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white lg:hover:bg-white/60 lg:dark:hover:bg-white/5'}`}
                >
                  <Icon className="w-4 h-4 hidden lg:block" />
                  <span className="lg:flex-1 text-left">{label}</span>
                  {counts[id] > 0 && (
                    <span className="text-xs font-medium text-zinc-400 tabular-nums">{counts[id]}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="hidden lg:flex mt-6 pt-6 w-full border-t border-zinc-200 dark:border-white/10 items-center gap-3 px-3 text-sm font-semibold text-zinc-500 hover:text-red-600 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </aside>

        {/* Contenido */}
        <main className="min-w-0">

          {activeTab === 'orders' && (
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Pedidos</h1>
                  <p className="text-sm text-zinc-500 mt-1">Seguí tus compras, descargá comprobantes y volvé a comprar.</p>
                </div>
                {orders.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrar pedidos">
                    {ORDER_FILTERS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOrderFilter(f.id)}
                        aria-pressed={orderFilter === f.id}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold border transition ${orderFilter === f.id
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-white/30'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-4" aria-busy="true">
                  {[0, 1].map(i => (
                    <div key={i} className="h-64 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 animate-pulse" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Todavía no compraste nada"
                  text="Cuando hagas tu primera compra, la vas a poder seguir desde acá."
                  action="Ir a la tienda"
                  onAction={() => navigate('/')}
                />
              ) : visibleOrders.length === 0 ? (
                <p className="py-16 text-center text-sm text-zinc-500">No hay pedidos en esta categoría.</p>
              ) : (
                <div className="space-y-5">
                  {visibleOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onTrack={(o) => navigate(`/seguimiento?order=${o.id}`)}
                      onReceipt={printReceipt}
                      onReorder={handleReorder}
                      onOpenProduct={(id) => navigate(`/producto/${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'favorites' && (
            <section>
              <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Favoritos</h1>
                <p className="text-sm text-zinc-500 mt-1">Los productos que guardaste para después.</p>
              </div>

              {favoriteProducts.length === 0 ? (
                <EmptyState
                  icon={Heart}
                  title="No tenés favoritos"
                  text="Tocá el corazón en los productos que te gusten para guardarlos acá."
                  action="Explorar catálogo"
                  onAction={() => navigate('/')}
                />
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-8">
                  {favoriteProducts.map(p => {
                    const finalPrice = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
                    return (
                      <div key={p.id} className="group relative">
                        <button type="button" onClick={() => navigate(`/producto/${p.id}`)} className="block w-full text-left">
                          <div className="aspect-[4/5] bg-zinc-100 dark:bg-zinc-900 rounded-2xl overflow-hidden mb-3">
                            {p.imageUrl ? (
                              <img loading="lazy" decoding="async" src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Sin foto</span></div>
                            )}
                          </div>
                          <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{p.name}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="font-bold text-zinc-900 dark:text-white">{formatMoney(finalPrice)}</span>
                            {p.discount > 0 && <span className="text-zinc-400 line-through">{formatMoney(p.price)}</span>}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(p.id)}
                          className="absolute top-3 right-3 w-9 h-9 bg-white/90 dark:bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-red-500 hover:scale-110 transition-transform shadow-sm"
                          aria-label={`Quitar ${p.name} de favoritos`}
                        >
                          <Heart className="w-4 h-4 fill-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === 'datos' && (
            <section>
              <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Mis datos</h1>
                <p className="text-sm text-zinc-500 mt-1">Los usamos para completar tus próximas compras más rápido.</p>
              </div>

              <form onSubmit={handleSaveDatos} className="space-y-5">
                {datosSuccess && <div role="status" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl font-semibold text-sm">{datosSuccess}</div>}
                {datosError && <div role="alert" className="bg-red-500/10 text-red-700 dark:text-red-400 p-4 rounded-xl font-semibold text-sm">{datosError}</div>}

                <FormSection icon={User} title="Datos personales">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Nombre completo" autoComplete="name" value={datosForm.name} onChange={e => setDatosForm({ ...datosForm, name: e.target.value })} />
                    <Field label="DNI" inputMode="numeric" value={datosForm.document} onChange={e => setDatosForm({ ...datosForm, document: e.target.value })} />
                    <Field label="Teléfono" type="tel" autoComplete="tel" className="sm:col-span-2" value={datosForm.phone} onChange={e => setDatosForm({ ...datosForm, phone: e.target.value })} />
                  </div>
                </FormSection>

                <FormSection icon={MapPin} title="Dirección de envío predeterminada">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Calle" autoComplete="address-line1" className="col-span-2" value={datosForm.address.street} onChange={e => setAddress('street', e.target.value)} />
                    <Field label="Número" value={datosForm.address.number} onChange={e => setAddress('number', e.target.value)} />
                    <Field label="Depto / Piso (opcional)" autoComplete="address-line2" className="col-span-3 sm:col-span-2" value={datosForm.address.apartment} onChange={e => setAddress('apartment', e.target.value)} />
                    <Field label="Código postal" autoComplete="postal-code" className="col-span-3 sm:col-span-1" value={datosForm.address.zip} onChange={e => setAddress('zip', e.target.value)} />
                    <Field label="Ciudad" autoComplete="address-level2" className="col-span-3 sm:col-span-2" value={datosForm.address.city} onChange={e => setAddress('city', e.target.value)} />
                    <Field label="Provincia" autoComplete="address-level1" className="col-span-3 sm:col-span-1" value={datosForm.address.state} onChange={e => setAddress('state', e.target.value)} />
                  </div>
                </FormSection>

                <FormSection icon={Key} title="Seguridad">
                  <Field label="Nueva contraseña" type="password" autoComplete="new-password" placeholder="Dejala en blanco para no cambiarla" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </FormSection>

                <div className="flex justify-end">
                  <button disabled={isSavingDatos} type="submit" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold px-8 py-3.5 hover:opacity-85 transition disabled:opacity-60">
                    {isSavingDatos ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function FormSection({ icon: Icon, title, children }) {
  return (
    <div className="bg-white dark:bg-[#0c0c0c] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white mb-5">
        <Icon className="w-4 h-4 text-zinc-500" /> {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="bg-white dark:bg-[#0c0c0c] border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl px-6 py-16 text-center flex flex-col items-center">
      <span className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-5">
        <Icon className="w-6 h-6 text-zinc-400" />
      </span>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1.5 mb-6 max-w-sm">{text}</p>
      <button type="button" onClick={onAction} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold px-6 py-3 hover:opacity-85 transition">
        {action} <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
