import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { supabase } from '../../supabaseClient';
import { parseBannerUrl, buildBannerUrl, DEFAULT_BANNER_Y } from '../../bannerPosition';
import { BANNER_PRESETS, isPresetBanner, findPreset, presetValue, isDefaultTitle } from '../../bannerPresets';
import { compressImage } from '../../imageCompression';
import { panelPath } from '../../sitePaths';
import CampaignHero from '../../components/CampaignHero';
import { ensureFontCss, SCRIPT_FONT_CSS } from '../../branding';
import { SEASON_ART } from '../../components/campaignArt';
import { Palette, Settings, Bell, Shield, Store, Save, TicketPercent, CheckCircle2, Upload, Loader2, Image as ImageIcon, Truck, MapPin, MoveVertical, AlignVerticalJustifyCenter } from 'lucide-react';

// Panel › Ofertas: QUÉ se ofrece (campaña de temporada, banner y productos destacados).
// DÓNDE se ve en la portada se elige en Panel › Diseño.
export default function OffersPage() {
  useEffect(() => { ensureFontCss('pacifico', SCRIPT_FONT_CSS); }, []);
  const { store, storeSettings, updateStoreSettings, products, toggleProductCampaign, storeId } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [campaignActive, setCampaignActive] = useState(storeSettings?.campaign_active || false);
  const [campaignName, setCampaignName] = useState(storeSettings?.campaign_name || '');
  // El banner se guarda como URL + encuadre vertical (ver bannerPosition.js)
  const [campaignImageUrl, setCampaignImageUrl] = useState(() => parseBannerUrl(storeSettings?.campaign_image_url).src);
  const [campaignImageY, setCampaignImageY] = useState(() => parseBannerUrl(storeSettings?.campaign_image_url).y);

  const fileInputRef = useRef(null);
  const bannerImgRef = useRef(null);
  const bannerDragRef = useRef(null);

  // Cuando terminan de cargar los datos de la tienda, el formulario los toma
  useEffect(() => {
    if (!storeSettings) return;
    setCampaignActive(storeSettings.campaign_active || false);
    setCampaignName(storeSettings.campaign_name || '');
    const banner = parseBannerUrl(storeSettings.campaign_image_url);
    setCampaignImageUrl(banner.src);
    setCampaignImageY(banner.y);
  }, [storeSettings?.campaign_active, storeSettings?.campaign_name, storeSettings?.campaign_image_url]);

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

  // Elegir un banner de temporada. Si el nombre de la campaña es uno de los títulos por defecto
  // (o está vacío), se reemplaza por el del nuevo; si lo escribió el admin, se respeta.
  const selectBannerPreset = (preset) => {
    setCampaignImageUrl(presetValue(preset));
    setCampaignImageY(DEFAULT_BANNER_Y);
    if (isDefaultTitle(campaignName)) setCampaignName(preset.defaultTitle);
  };
  const selectedPreset = findPreset(campaignImageUrl);
  const isCustomBanner = Boolean(campaignImageUrl) && !isPresetBanner(campaignImageUrl);
  const campaignProducts = products.filter(p => p.in_campaign && p.is_active);
  const campaignMaxDiscount = Math.max(0, ...campaignProducts.map(p => Number(p.discount) || 0));


  const handleSave = async () => {
    setIsSaving(true);
    const ok = await updateStoreSettings({
      campaign_active: campaignActive,
      campaign_name: campaignName,
      campaign_image_url: buildBannerUrl(campaignImageUrl, campaignImageY)
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
    const original = e.target.files[0];
    e.target.value = '';
    if (!original) return;

    setIsUploading(true);
    try {
      // Se achica antes de subir (un banner no necesita más de 2000 px)
      const file = await compressImage(original, { maxSize: 2000 });
      const fileExt = file.name.split('.').pop();
      const fileName = `campaign_banner_${Math.random()}.${fileExt}`;
      const filePath = `${storeId}/banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, { contentType: file.type, cacheControl: '31536000' });

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
    <div className="max-w-3xl mx-auto pb-20 md:pb-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3"><TicketPercent className="w-8 h-8 text-indigo-400" /> Ofertas</h1>
          <p className="text-zinc-400">Tu campaña de temporada: el banner y los productos que querés empujar.</p>
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

      <p className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
        <Palette className="w-5 h-5 shrink-0 text-indigo-400" />
        <span>¿Dónde aparece el banner en tu tienda? Lo elegís en <Link to={panelPath(store?.slug, 'diseno')} className="font-semibold text-indigo-300 hover:text-indigo-200">Diseño › Portada</Link>, con vista previa en vivo.</span>
      </p>

              <div className="bg-gradient-to-br from-black to-zinc-900 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2 relative z-10">
                  <h2 className="text-xl font-bold text-white">Campaña de temporada</h2>
                                  </div>
                <p className="text-zinc-400 text-sm mb-6 border-b border-white/10 pb-4 relative z-10">Un banner con el nombre de la campaña y un carrusel con los productos que elijas.</p>
                
                <label className="flex items-center justify-between cursor-pointer p-4 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/5 mb-6 relative z-10" onClick={() => setCampaignActive(!campaignActive)}>
                  <div>
                    <div className="text-white font-bold mb-1">Activar la campaña</div>
                    <div className="text-zinc-400 text-sm">Se muestra en la portada de tu tienda.</div>
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

                      {/* Banners de temporada listos para usar, o una imagen propia */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2" role="radiogroup" aria-label="Banner de la campaña">
                        {BANNER_PRESETS.map(preset => {
                          const isSelected = selectedPreset?.id === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => selectBannerPreset(preset)}
                              className={`relative aspect-[3/1] rounded-lg overflow-hidden border-2 transition ${isSelected ? 'border-indigo-500' : 'border-white/10 hover:border-white/30'}`}
                            >
                              {/* Miniatura: color de la temporada, uno de sus objetos y el nombre */}
                              <span className="absolute inset-0 flex items-center justify-between gap-1 px-2" style={{ backgroundColor: preset.colors.bg }}>
                                <span className="text-sm leading-none" style={{ fontFamily: "'Pacifico', cursive", color: preset.colors.script }}>
                                  {preset.label}
                                </span>
                                <span className="w-7 shrink-0">
                                  {(() => { const { C, props } = SEASON_ART[preset.id].narrow[0]; return <C {...props} />; })()}
                                </span>
                              </span>
                              {isSelected && <CheckCircle2 className="absolute top-1 right-1 w-4 h-4 text-indigo-400 drop-shadow" />}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isCustomBanner}
                          onClick={() => !isUploading && fileInputRef.current?.click()}
                          className={`relative aspect-[3/1] rounded-lg overflow-hidden border-2 border-dashed transition flex items-center justify-center gap-1.5 text-[11px] font-bold ${isCustomBanner ? 'border-indigo-500 text-indigo-300' : 'border-white/15 text-zinc-400 hover:border-white/30 hover:text-white'}`}
                        >
                          {isCustomBanner ? (
                            <>
                              <img src={campaignImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                              <span className="relative bg-black/70 rounded px-1.5 py-0.5 text-white">Tu imagen</span>
                            </>
                          ) : (
                            <><Upload className="w-3.5 h-3.5" /> Subir propia</>
                          )}
                        </button>
                      </div>

                      {selectedPreset && !isUploading ? (
                        <>
                          {/* Vista previa real del banner, con el nombre de la campaña y la oferta de los productos elegidos */}
                          <div className="w-full h-56 rounded-xl overflow-hidden border border-white/10">
                            <CampaignHero
                              preset={selectedPreset}
                              title={campaignName}
                              maxDiscount={campaignMaxDiscount}
                              productCount={campaignProducts.length}
                              as="p"
                            />
                          </div>
                          <p className="text-xs text-zinc-500">
                            El titular es el nombre de la campaña: la última palabra va en letra script (por ejemplo "Summer Sale" o "Print Sale"). La oferta se calcula sola con el mayor descuento de los productos destacados abajo.
                          </p>
                        </>
                      ) : campaignImageUrl && !isUploading ? (
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
    </div>
  );
}
