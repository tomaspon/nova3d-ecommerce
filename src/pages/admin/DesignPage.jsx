import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Upload, Loader2, Trash2, CheckCircle2, AlertTriangle, ExternalLink, Palette, Type, Megaphone, AtSign, BookOpen, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useStore } from '../../context/StoreContext';
import { BRAND_COLORS, FONT_OPTIONS, normalizeBranding, inkFor } from '../../branding';

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
    iframeRef.current?.contentWindow?.postMessage({ type: 'store-branding-preview', branding: draft }, window.location.origin);
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
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setStatus('error');
      setMessage('El logo tiene que ser una imagen de hasta 2 MB.');
      return;
    }
    setIsUploading(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${storeId}/branding/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(path, file);
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
  const previewUrl = `/?tienda=${store?.slug || ''}`;

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
          </Section>

          <Section icon={Palette} title="Colores">
            <Field label="Color principal" hint="Botones, etiquetas y detalles de la tienda.">
              <div className="flex flex-wrap gap-2">
                {BRAND_COLORS.map(c => (
                  <button key={c.label} type="button" title={c.label} aria-label={c.label} aria-pressed={draft.primary_color === c.value}
                    onClick={() => set('primary_color')(c.value)}
                    className={`w-9 h-9 rounded-full border-2 transition ${draft.primary_color === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c.value || 'linear-gradient(135deg,#0b0b0b 50%,#ffffff 50%)' }} />
                ))}
                <label className="w-9 h-9 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center cursor-pointer overflow-hidden" title="Otro color">
                  <input type="color" value={draft.primary_color || '#4f46e5'} onChange={setFromInput('primary_color')} className="opacity-0 absolute w-0 h-0" />
                  <span className="text-[10px] text-zinc-400">+</span>
                </label>
              </div>
              {draft.primary_color && (
                <span className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold" style={{ background: draft.primary_color, color: inkFor(draft.primary_color) }}>
                  Así se ve un botón
                </span>
              )}
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
              <Field label="Texto del anuncio">
                <input className={inputClass} value={draft.announcement_text} onChange={setFromInput('announcement_text')} placeholder="Envío gratis desde $50.000 · 3 cuotas sin interés" maxLength={120} />
              </Field>
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
