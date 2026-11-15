import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Upload, Loader2, Trash2, CheckCircle2, AlertTriangle, ExternalLink, Palette, Type, Megaphone, AtSign, BookOpen, Image as ImageIcon, LayoutGrid, Square } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { storesOrigin } from '../../platformBrand';
import { compressImage } from '../../imageCompression';

// La tienda se previsualiza en la dirección de las tiendas (el panel puede estar en la de la plataforma)
const PREVIEW_ORIGIN = storesOrigin() || window.location.origin;
import { BRAND_COLORS, FONT_OPTIONS, BUTTON_SHAPES, IMAGE_RATIOS, BACKGROUNDS, DARK_BACKGROUNDS, ACCENT_COLORS, SORT_OPTIONS, GRID_COLUMNS, normalizeBranding, inkFor } from '../../branding';

// Panel > Diseño: el dueño cambia la marca de su tienda y la ve en vivo antes de publicarla.
// La vista previa es la tienda real en un iframe; el borrador le llega por postMessage.

const DEVICES = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 780 } };
const inputClass = 'w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="border-b border-white/5 pb-6 last:border-0">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-4"><Icon className="w-4 h-4 text-indigo-300" /> {title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-zinc-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1.5 text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-zinc-300">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function Choices({ options, value, onChange, columns = 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`rounded-xl px-2 py-2 text-xs font-semibold border transition ${value === o.value ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ options, value, onChange, customLabel = 'Otro color', allowCustom = true }) {
  const isCustom = value && !options.some(o => o.value === value);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.label} type="button" title={o.label} aria-label={o.label} aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`w-8 h-8 rounded-full border-2 transition ${value === o.value ? 'border-white scale-110' : 'border-white/10'}`}
          style={{ background: o.swatch || o.value }} />
      ))}
      {allowCustom && <label title={customLabel} className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden ${isCustom ? 'border-white scale-110' : 'border-dashed border-white/30'}`}
        style={isCustom ? { background: value } : undefined}>
        {/* El selector nativo solo acepta colores #rrggbb: con una opción predefinida arranca en gris */}
        <input type="color" aria-label={customLabel} value={isCustom ? value : '#888888'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        {!isCustom && <span className="text-[11px] text-zinc-400">+</span>}
      </label>}
    </div>
  );
}

export default function DesignPage() {
  const { store, storeId, updateBranding, storeSettings } = useStore();
  const saved = normalizeBranding(store?.branding);
  const [draft, setDraft] = useState(saved);
  const [device, setDevice] = useState('desktop');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  const iframeRef = useRef(null);
  const boxRef = useRef(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (field) => (value) => setDraft(prev => ({ ...prev, [field]: value }));
  const setFromInput = (field) => (e) => set(field)(e.target.value);

  // La vista previa recibe el borrador cada vez que cambia (y cuando termina de cargar)
  const sendPreview = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'store-branding-preview', branding: draft }, PREVIEW_ORIGIN);
  };
  useEffect(sendPreview, [draft]);

  useEffect(() => {
    if (!boxRef.current) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  // Avisar antes de salir con cambios sin publicar
  useEffect(() => {
    if (!isDirty) return;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [isDirty]);

  const uploadLogo = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original) return;
    if (!original.type.startsWith('image/')) {
      setStatus('error');
      setMessage('El logo tiene que ser una imagen.');
      return;
    }
    setIsUploading(true);
    // Se achica (conservando la transparencia); un logo no necesita más de 600 px
    const file = await compressImage(original, { maxSize: 600, keepTransparency: true });
    if (file.size > 2 * 1024 * 1024) {
      setIsUploading(false);
      setStatus('error');
      setMessage('El logo es demasiado pesado (más de 2 MB). Probá con otra imagen.');
      return;
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${storeId}/branding/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (error) {
      setStatus('error');
      setMessage('No se pudo subir el logo.');
    } else {
      set('logo_url')(supabase.storage.from('images').getPublicUrl(path).data.publicUrl);
    }
    setIsUploading(false);
  };

  const publish = async () => {
    setStatus('saving');
    const result = await updateBranding(draft);
    setStatus(result.success ? 'saved' : 'error');
    setMessage(result.success ? 'Publicado: tus clientes ya ven los cambios.' : result.error);
    if (result.success) setTimeout(() => setStatus('idle'), 3000);
  };

  const spec = DEVICES[device];
  const frameWidth = device === 'mobile' ? Math.min(boxWidth, 300) : boxWidth;
  const scale = frameWidth ? frameWidth / spec.width : 0;
  const previewUrl = `${PREVIEW_ORIGIN}/?tienda=${store?.slug || ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Diseño</h1>
          <p className="text-zinc-400 text-sm mt-1">Personalizá cómo se ve tu tienda. Mirá los cambios en vivo y publicalos cuando te gusten.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-xs font-semibold text-amber-300">Cambios sin publicar</span>}
          <button type="button" onClick={() => setDraft(saved)} disabled={!isDirty || status === 'saving'} className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 disabled:opacity-40 transition">Descartar</button>
          <button type="button" onClick={publish} disabled={!isDirty || status === 'saving'} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white disabled:opacity-40 transition">
            {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />} Publicar cambios
          </button>
        </div>
      </div>

      {(status === 'saved' || status === 'error') && (
        <div role="status" className={`flex gap-2 rounded-xl p-3 text-sm ${status === 'saved' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>
          {status === 'saved' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />} {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] items-start">
        {/* Controles */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-6 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto">
          <Section icon={ImageIcon} title="Logo">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                {draft.logo_url ? <img src={draft.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-zinc-400">Sin logo</span>}
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white cursor-pointer transition">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir logo
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={isUploading} />
                </label>
                {draft.logo_url && (
                  <button type="button" onClick={() => set('logo_url')('')} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /> Quitar</button>
                )}
                <p className="text-[11px] text-zinc-500">PNG con fondo transparente, hasta 2 MB. También se usa como ícono de la pestaña.</p>
              </div>
            </div>
            {draft.logo_url && <Toggle checked={draft.show_store_name} onChange={set('show_store_name')} label="Mostrar el nombre al lado del logo" />}
          </Section>

          <Section icon={Palette} title="Colores">
            <Field label="Color principal" hint="Botones, menú y detalles de la tienda.">
              <Swatches options={BRAND_COLORS.map(c => ({ ...c, swatch: c.value || 'linear-gradient(135deg,#0b0b0b 50%,#ffffff 50%)' }))} value={draft.primary_color} onChange={set('primary_color')} />
              {draft.primary_color && (
                <span className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold" style={{ background: draft.primary_color, color: inkFor(draft.primary_color) }}>
                  Así se ve un botón
                </span>
              )}
            </Field>
            <Field label="Color de las ofertas" hint='Etiquetas "% OFF" de los productos.'>
              <Swatches options={ACCENT_COLORS.map(c => ({ ...c, swatch: c.value || '#ef4444' }))} value={draft.accent_color} onChange={set('accent_color')} />
            </Field>
            <Field label="Fondo (modo claro)">
              <Swatches
                options={BACKGROUNDS.map(b => ({ label: b.label, value: b.id, swatch: b.color }))}
                value={draft.background_custom || draft.background}
                onChange={(v) => setDraft(prev => (v.startsWith('#') ? { ...prev, background_custom: v } : { ...prev, background: v, background_custom: '' }))}
                customLabel="Otro fondo"
              />
            </Field>
            <Field label="Fondo (modo oscuro)">
              <Swatches options={DARK_BACKGROUNDS.map(b => ({ label: b.label, value: b.id, swatch: b.color }))} value={draft.dark_background}
                onChange={set('dark_background')} allowCustom={false} />
            </Field>
            <Field label="Modo por defecto" hint="El visitante igual puede cambiarlo con el botón de sol y luna.">
              <div className="grid grid-cols-2 gap-2">
                {[['light', 'Claro'], ['dark', 'Oscuro']].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => set('theme')(id)} aria-pressed={draft.theme === id}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold border transition ${draft.theme === id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}>{label}</button>
                ))}
              </div>
            </Field>
          </Section>

          <Section icon={Type} title="Tipografía">
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map(f => (
                <button key={f.id} type="button" onClick={() => set('font')(f.id)} aria-pressed={draft.font === f.id}
                  className={`rounded-xl px-3 py-3 text-left border transition ${draft.font === f.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'}`}>
                  {f.css && <link rel="stylesheet" href={f.css} />}
                  <span className="block text-lg text-white leading-none" style={{ fontFamily: f.family }}>Aa</span>
                  <span className="block mt-1 text-xs text-zinc-400">{f.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section icon={Square} title="Botones">
            <Choices options={BUTTON_SHAPES.map(b => ({ value: b.id, label: b.label }))} value={draft.button_shape} onChange={set('button_shape')} />
          </Section>

          <Section icon={LayoutGrid} title="Catálogo">
            <Field label="Formato de las fotos">
              <Choices options={IMAGE_RATIOS.map(r => ({ value: r.id, label: r.label }))} value={draft.image_ratio} onChange={set('image_ratio')} />
            </Field>
            <Field label="Columnas en computadora">
              <Choices options={GRID_COLUMNS.map(n => ({ value: n, label: `${n} columnas` }))} value={draft.grid_columns} onChange={set('grid_columns')} />
            </Field>
            <Field label="Orden por defecto">
              <Choices options={SORT_OPTIONS} value={draft.default_sort} onChange={set('default_sort')} columns={2} />
            </Field>
            <Toggle checked={draft.show_category} onChange={set('show_category')} label="Mostrar la categoría en cada producto" />
            <Toggle checked={draft.quick_add} onChange={set('quick_add')} label='Botón rápido "Agregar al carrito"' />
            <Toggle checked={draft.show_benefits} onChange={set('show_benefits')} label="Franja de beneficios" />
            <Toggle checked={draft.show_coming_soon} onChange={set('show_coming_soon')} label='Tarjeta "Próximamente" (con pocos productos)' />
          </Section>

          <Section icon={Megaphone} title="Portada y anuncio">
            <Field label="Titular: parte suave" hint='Se muestra cuando no hay un banner de campaña activo. Ej: "Lo nuevo de"'>
              <input className={inputClass} value={draft.headline_light} onChange={setFromInput('headline_light')} placeholder="Lo nuevo de" maxLength={60} />
            </Field>
            <Field label="Titular: parte destacada">
              <input className={inputClass} value={draft.headline_bold} onChange={setFromInput('headline_bold')} placeholder={store?.name} maxLength={60} />
            </Field>
            <Field label="Frase de la marca" hint="Aparece al pie de la tienda.">
              <input className={inputClass} value={draft.tagline} onChange={setFromInput('tagline')} placeholder={`Tienda online oficial de ${store?.name || ''}`} maxLength={140} />
            </Field>
            <Toggle checked={draft.announcement_active} onChange={set('announcement_active')} label="Barra de anuncio arriba de todo" />
            {draft.announcement_active && (
              <>
                <Field label="Texto del anuncio">
                  <input className={inputClass} value={draft.announcement_text} onChange={setFromInput('announcement_text')} placeholder="Envío gratis desde $50.000 · 3 cuotas sin interés" maxLength={120} />
                </Field>
                <Field label="Color de la barra" hint="Sin elegir, usa el color principal.">
                  <Swatches options={[{ label: 'Color principal', value: '', swatch: draft.primary_color || 'linear-gradient(135deg,#0b0b0b 50%,#ffffff 50%)' }, ...ACCENT_COLORS.slice(1)]} value={draft.announcement_color} onChange={set('announcement_color')} />
                </Field>
              </>
            )}
          </Section>

          <Section icon={AtSign} title="Redes y contacto">
            <Field label="Instagram"><input className={inputClass} value={draft.instagram} onChange={setFromInput('instagram')} placeholder="@tumarca" /></Field>
            <Field label="TikTok"><input className={inputClass} value={draft.tiktok} onChange={setFromInput('tiktok')} placeholder="@tumarca" /></Field>
            <Toggle checked={draft.whatsapp_button} onChange={set('whatsapp_button')} label="Botón flotante de WhatsApp" />
            {draft.whatsapp_button && !storeSettings?.contact_whatsapp && (
              <p className="text-[11px] text-amber-300">Cargá tu WhatsApp en Configuración → Cobros para que aparezca.</p>
            )}
          </Section>

          <Section icon={BookOpen} title="Página Nosotros">
            <Field label="Título"><input className={inputClass} value={draft.about_title} onChange={setFromInput('about_title')} placeholder={`Conocé ${store?.name || ''}`} maxLength={80} /></Field>
            <Field label="Tu historia"><textarea className={`${inputClass} min-h-28`} value={draft.about_text} onChange={setFromInput('about_text')} placeholder="Contá quiénes son, qué hacen y por qué." maxLength={1200} /></Field>
          </Section>
        </div>

        {/* Vista previa en vivo */}
        <div className="xl:sticky xl:top-24 space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1" role="group" aria-label="Ver como">
              {[['desktop', 'Computadora', Monitor], ['mobile', 'Celular', Smartphone]].map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => setDevice(id)} aria-pressed={device === id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${device === id ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white">
              Abrir la tienda <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div ref={boxRef}>
            <div className={`mx-auto overflow-hidden bg-[#FAFAFA] ${device === 'mobile' ? 'rounded-[2rem] border-[8px] border-zinc-800' : 'rounded-xl border border-white/10'}`} style={{ width: frameWidth || '100%' }}>
              <div className="relative overflow-hidden" style={{ height: spec.height * scale || 500 }}>
                {scale > 0 && (
                  <iframe
                    ref={iframeRef}
                    key={device}
                    src={previewUrl}
                    title="Vista previa de la tienda"
                    onLoad={() => setTimeout(sendPreview, 300)}
                    className="absolute top-0 left-0 border-0 origin-top-left"
                    style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
                  />
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">Vista previa: lo que ves acá todavía no lo ven tus clientes hasta que tocás "Publicar cambios".</p>
        </div>
      </div>
    </div>
  );
}
