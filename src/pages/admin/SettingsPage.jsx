import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { supabase } from '../../supabaseClient';
import { parseBannerUrl, buildBannerUrl, DEFAULT_BANNER_Y } from '../../bannerPosition';
import { Settings, Bell, Shield, Store, CreditCard, Save, TicketPercent, CheckCircle2, Upload, Loader2, Image as ImageIcon, Truck, MapPin, MoveVertical, AlignVerticalJustifyCenter } from 'lucide-react';

export default function SettingsPage() {
  const { storeSettings, updateStoreSettings, products, toggleProductCampaign } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('campaigns'); // 'general', 'shipping', 'campaigns'

  // States for Settings
  const [campaignActive, setCampaignActive] = useState(storeSettings?.campaign_active || false);
  const [campaignName, setCampaignName] = useState(storeSettings?.campaign_name || '');
  // La URL guardada incluye el encuadre vertical (#y=NN); acá se manejan por separado
  const [campaignImageUrl, setCampaignImageUrl] = useState(() => parseBannerUrl(storeSettings?.campaign_image_url).src);
  const [campaignImageY, setCampaignImageY] = useState(() => parseBannerUrl(storeSettings?.campaign_image_url).y);
  const [storeName, setStoreName] = useState(storeSettings?.storeName || 'MINIMAL.');
  const [storeEmail, setStoreEmail] = useState(storeSettings?.storeEmail || '');
  const [shippingCost, setShippingCost] = useState(storeSettings?.shippingCost || 5000);

  const fileInputRef = useRef(null);
  const bannerImgRef = useRef(null);
  const bannerDragRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // La configuración llega de Supabase después del primer render: sincronizar el formulario cuando carga
  useEffect(() => {
    setCampaignActive(storeSettings.campaign_active || false);
    setCampaignName(storeSettings.campaign_name || '');
    const banner = parseBannerUrl(storeSettings.campaign_image_url);
    setCampaignImageUrl(banner.src);
    setCampaignImageY(banner.y);
  }, [storeSettings.campaign_active, storeSettings.campaign_name, storeSettings.campaign_image_url]);

  // Arrastrar el banner hacia arriba o abajo para elegir qué franja de la imagen se ve
  const handleBannerPointerDown = (e) => {
    if (isUploading || !bannerImgRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    bannerDragRef.current = { startClientY: e.clientY, startY: campaignImageY };
  };

  const handleBannerPointerMove = (e) => {
    const drag = bannerDragRef.current;
    const img = bannerImgRef.current;
    if (!drag || !img || !img.naturalWidth) return;
    const box = e.currentTarget.getBoundingClientRect();
    // object-cover: la imagen se escala hasta cubrir la caja; lo que sobra en alto es lo que se puede desplazar
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const overflow = img.naturalHeight * scale - box.height;
    if (overflow <= 0) return;
    const nextY = drag.startY - ((e.clientY - drag.startClientY) / overflow) * 100;
    setCampaignImageY(Math.min(100, Math.max(0, nextY)));
  };

  const handleBannerPointerUp = () => {
    bannerDragRef.current = null;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await updateStoreSettings({
      campaign_active: campaignActive,
      campaign_name: campaignName,
      campaign_image_url: buildBannerUrl(campaignImageUrl, campaignImageY),
      storeName,
      storeEmail,
      shippingCost
    });
    setIsSaving(false);
    if (!ok) {
      alert('No se pudieron guardar los cambios');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `campaign_banner_${Math.random()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setCampaignImageUrl(data.publicUrl);
      setCampaignImageY(DEFAULT_BANNER_Y);
    } catch (err) {
      console.error('Error subiendo banner:', err);
      alert('Error subiendo imagen');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 md:pb-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">Configuración</h1>
          <p className="text-zinc-400">Ajustes generales, motor de campañas y logística.</p>
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
            onClick={() => setActiveTab('campaigns')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'campaigns' ? 'bg-indigo-500/10 text-indigo-400 shadow-inner' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
          >
            <TicketPercent className="w-5 h-5" /> Motor de Ofertas
          </button>
          
          <button 
            onClick={() => setActiveTab('shipping')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'shipping' ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Truck className="w-5 h-5" /> Envíos & Pagos
          </button>

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
              <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4">Información pública visible para tus clientes.</p>
              
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
              <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-xl font-bold text-white mb-2">Pasarelas de Pago</h2>
                <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4">Configuración de cobros en tu tienda.</p>
                
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">MercadoPago</div>
                      <div className="text-blue-400 text-xs">Conectado exitosamente</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </>
          )}

          {/* TAB: CAMPAIGNS */}
          {activeTab === 'campaigns' && (
            <>
              <div className="bg-gradient-to-br from-black to-zinc-900 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2 relative z-10">
                  <h2 className="text-xl font-bold text-white">Sección Temática (Hero)</h2>
                  <div className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded shrink-0 w-fit">
                    Base de Datos Conectada
                  </div>
                </div>
                <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4 relative z-10">Inyecta un banner espectacular y promociona productos específicos en la portada.</p>
                
                <label className="flex items-center justify-between cursor-pointer p-4 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/5 mb-6 relative z-10" onClick={() => setCampaignActive(!campaignActive)}>
                  <div>
                    <div className="text-white font-bold mb-1">Habilitar Banner Principal</div>
                    <div className="text-zinc-400 text-sm">Aparecerá en lo más alto de tu tienda.</div>
                  </div>
                  <div className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${campaignActive ? 'bg-indigo-500' : 'bg-zinc-800'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${campaignActive ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </div>
                </label>

                {campaignActive && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 relative z-10">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nombre de la Campaña Actual</label>
                      <input 
                        type="text" 
                        value={campaignName}
                        onChange={e => setCampaignName(e.target.value)}
                        placeholder="Ej. Black Friday 2026"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Imagen de Portada (Banner)</label>
                      {campaignImageUrl && !isUploading ? (
                        <>
                          {/* Con imagen cargada, la caja sirve para encuadrar: se arrastra en vertical.
                              Usa la proporción del banner en escritorio, que es donde más se recorta. */}
                          <div
                            onPointerDown={handleBannerPointerDown}
                            onPointerMove={handleBannerPointerMove}
                            onPointerUp={handleBannerPointerUp}
                            onPointerCancel={handleBannerPointerUp}
                            className="w-full aspect-[9/2] rounded-xl border-2 border-indigo-500/30 relative overflow-hidden bg-black/50 cursor-grab active:cursor-grabbing touch-none select-none group"
                          >
                            <img
                              ref={bannerImgRef}
                              src={campaignImageUrl}
                              alt="Banner Preview"
                              draggable={false}
                              className="w-full h-full object-cover pointer-events-none"
                              style={{ objectPosition: `50% ${campaignImageY}%` }}
                            />
                            <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
                              <span className="bg-black/70 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5">
                                <MoveVertical className="w-3.5 h-3.5" /> Arrastrá para encuadrar
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setCampaignImageY(DEFAULT_BANNER_Y)}
                              disabled={Math.round(campaignImageY) === DEFAULT_BANNER_Y}
                              className="px-3 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> Centrar
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 rounded-lg transition flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" /> Cambiar Portada
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          onClick={() => !isUploading && fileInputRef.current?.click()}
                          className={`w-full h-40 rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition group bg-black/50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                              <span className="text-xs font-bold text-indigo-300">Subiendo a la nube...</span>
                            </div>
                          ) : (
                            <div className="text-center p-4">
                              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3 group-hover:text-indigo-400 transition" />
                              <span className="text-sm font-bold text-zinc-400 group-hover:text-indigo-300">Subir nueva portada</span>
                            </div>
                          )}
                        </div>
                      )}
                      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-4">Destacar Productos en esta campaña</label>
                      <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar divide-y divide-white/5">
                        {products.map(p => (
                          <label key={p.id} className="flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer transition">
                            <input 
                              type="checkbox" 
                              checked={!!p.in_campaign}
                              onChange={() => toggleProductCampaign(p.id, !!p.in_campaign)}
                              className="w-5 h-5 rounded border-white/10 bg-black text-indigo-500 focus:ring-indigo-500 focus:ring-offset-black"
                            />
                            <div className="w-10 h-10 bg-zinc-900 rounded overflow-hidden shrink-0">
                              {p.imageUrl ? <img loading="lazy" decoding="async" src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 m-3 text-zinc-700" />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-white">{p.name}</div>
                              <div className="text-xs text-zinc-500">${Number(p.price).toLocaleString('es-AR')}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
