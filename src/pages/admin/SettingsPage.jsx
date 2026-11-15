import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { panelPath } from '../../sitePaths';
import PaymentSettings from './PaymentSettings';
import { Bell, Store, Save, TicketPercent, CheckCircle2, Loader2, Truck } from 'lucide-react';

// Panel › Configuración: los datos de la tienda, envíos y cobros.
// La campaña de temporada vive en Panel › Ofertas.
export default function SettingsPage() {
  const { store, storeSettings, updateStoreSettings } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'shipping'

  const [storeName, setStoreName] = useState(storeSettings?.store_name || '');
  const [storeEmail, setStoreEmail] = useState(storeSettings?.store_email || '');
  const [shippingCost, setShippingCost] = useState(storeSettings?.shipping_cost || 0);

  // La configuración llega de Supabase después del primer render: el formulario la toma cuando carga
  useEffect(() => {
    if (!storeSettings) return;
    setStoreName(storeSettings.store_name || '');
    setStoreEmail(storeSettings.store_email || '');
    setShippingCost(storeSettings.shipping_cost || 0);
  }, [storeSettings?.store_name, storeSettings?.store_email, storeSettings?.shipping_cost]);

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await updateStoreSettings({
      store_name: storeName,
      store_email: storeEmail,
      shipping_cost: shippingCost
    });
    setIsSaving(false);
    if (!ok) {
      alert('No se pudieron guardar los cambios');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 md:pb-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">Configuración</h1>
          <p className="text-zinc-400">Los datos de tu tienda, envíos y cobros. Las ofertas están en su propia sección.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 w-full md:w-auto"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* SIDEBAR TABS */}
        <div className="md:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'general' ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Store className="w-5 h-5" /> Tienda & Perfil
          </button>
          
          <button 
            onClick={() => setActiveTab('shipping')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'shipping' ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Truck className="w-5 h-5" /> Envíos & Pagos
          </button>

          <Link to={panelPath(store?.slug, 'ofertas')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
            <TicketPercent className="w-5 h-5" /> Ofertas <span className="ml-auto text-xs font-semibold">→</span>
          </Link>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-zinc-600 opacity-50 cursor-not-allowed">
            <Bell className="w-5 h-5" /> Notificaciones (Pronto)
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="md:col-span-2 space-y-6">
          
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-white mb-2">Perfil de la Tienda</h2>
              <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4">Se usan en los mails de compra: el nombre como remitente, y las respuestas de tus clientes te llegan a este email.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nombre del Negocio</label>
                  <input 
                    type="text" 
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Email de Contacto</label>
                  <input 
                    type="email" 
                    value={storeEmail}
                    onChange={e => setStoreEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHIPPING */}
          {activeTab === 'shipping' && (
            <>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-xl font-bold text-white mb-2">Logística Nacional</h2>
                <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4">Ajustes de envíos e integraciones con correos.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Costo de Envío Fijo ($)</label>
                    <input 
                      type="number" 
                      value={shippingCost}
                      onChange={e => setShippingCost(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                    />
                    <p className="text-xs text-zinc-500 mt-2">Este costo se sumará automáticamente a las compras que requieran envío a domicilio.</p>
                  </div>
                </div>
              </div>
              <PaymentSettings />
            </>
          )}


        </div>
      </div>
    </div>
  );
}
