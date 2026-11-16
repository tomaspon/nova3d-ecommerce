import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, Check, ShoppingBag } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { BRAND_COLORS, FONT_OPTIONS, BACKGROUNDS, DARK_BACKGROUNDS, BUTTON_SHAPES, normalizeBranding, inkFor } from '../../branding';

// Paso "Diseño" del alta: lo básico de cómo se ve la tienda, con una vista previa al lado.
// Todo lo demás (logo, textos, anuncio, catálogo) se ajusta después en Panel > Diseño.

const RADIUS = { pill: '9999px', soft: '0.75rem', square: '0.25rem' };

// Carga la tipografía para verla en la vista previa (la misma hoja que usa la tienda)
function useFont(font) {
  useEffect(() => {
    if (!font.css || document.querySelector(`link[data-brand-font="${font.id}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.css;
    link.dataset.brandFont = font.id;
    document.head.appendChild(link);
  }, [font]);
}

function Option({ selected, onClick, children, label }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} aria-label={label} title={label}
      className={`relative rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected ? 'border-indigo-600 ring-2 ring-indigo-600/20 text-zinc-900 dark:text-white' : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/30'}`}>
      {children}
    </button>
  );
}

function Group({ title, children }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-zinc-900 mb-2 dark:text-white">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Preview({ name, design }) {
  const font = FONT_OPTIONS.find(f => f.id === design.font);
  const dark = design.theme === 'dark';
  const bg = dark ? DARK_BACKGROUNDS[0].color : BACKGROUNDS.find(b => b.id === design.background).color;
  const brand = design.primary_color || (dark ? '#ffffff' : '#0b0b0b');
  const ink = design.primary_color ? inkFor(brand) : (dark ? '#0b0b0b' : '#ffffff');
  const text = dark ? '#f4f4f5' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const card = dark ? '#1f1f22' : '#e9e9ec';
  const radius = RADIUS[design.button_shape];

  return (
    <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-sm" aria-label="Vista previa de tu tienda">
      <div className="flex items-center gap-1.5 px-3 h-7 bg-zinc-100 border-b border-zinc-200">
        {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-zinc-300" />)}
      </div>
      <div style={{ background: bg, color: text, fontFamily: font.family }} className="p-4 transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-extrabold tracking-tight truncate">{name || 'Tu tienda'}</span>
          <ShoppingBag className="w-4 h-4" style={{ color: muted }} />
        </div>
        <p className="mt-6 text-2xl leading-tight tracking-tight">
          <span style={{ color: muted }}>Lo nuevo de</span><br />
          <b className="font-extrabold">{name || 'tu marca'}</b>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {['Producto', 'Producto'].map((label, i) => (
            <div key={i}>
              <div className="aspect-[4/5] rounded-lg" style={{ background: card }} />
              <p className="mt-1.5 text-xs font-semibold">{label} {i + 1}</p>
              <p className="text-xs" style={{ color: muted }}>$ 12.500</p>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-xs font-bold py-2.5" style={{ background: brand, color: ink, borderRadius: radius }}>
          Agregar al carrito
        </div>
      </div>
    </div>
  );
}

export default function DesignStep({ store, onDone }) {
  const [design, setDesign] = useState(() => normalizeBranding(store?.branding));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field, value) => setDesign(prev => ({ ...prev, [field]: value }));
  useFont(FONT_OPTIONS.find(f => f.id === design.font));

  const save = async () => {
    setIsSaving(true);
    setError('');
    const { data, error: saveError } = await supabase.from('stores')
      .update({ branding: normalizeBranding(design) }).eq('id', store.id).select('id');
    setIsSaving(false);
    if (saveError || !data?.length) { setError('No pudimos guardar el diseño. Podés cambiarlo después desde tu panel.'); return; }
    onDone();
  };

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_17rem] gap-8">
      <div className="space-y-6">
        <Group title="Color principal">
          {BRAND_COLORS.map(c => (
            <Option key={c.label} label={c.label} selected={design.primary_color === c.value} onClick={() => set('primary_color', c.value)}>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: c.value || '#0b0b0b' }} />
                {c.label}
                {design.primary_color === c.value && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              </span>
            </Option>
          ))}
        </Group>
        <Group title="Tipografía">
          {FONT_OPTIONS.map(f => (
            <Option key={f.id} selected={design.font === f.id} onClick={() => set('font', f.id)}>
              <span style={{ fontFamily: f.family }}>{f.label}</span>
            </Option>
          ))}
        </Group>
        <Group title="Modo">
          {[['light', 'Claro'], ['dark', 'Oscuro']].map(([id, label]) => (
            <Option key={id} selected={design.theme === id} onClick={() => set('theme', id)}>{label}</Option>
          ))}
        </Group>
        {design.theme === 'light' && (
          <Group title="Fondo">
            {BACKGROUNDS.map(b => (
              <Option key={b.id} selected={design.background === b.id} onClick={() => set('background', b.id)}>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-black/10" style={{ background: b.color }} />{b.label}
                </span>
              </Option>
            ))}
          </Group>
        )}
        <Group title="Botones">
          {BUTTON_SHAPES.map(s => (
            <Option key={s.id} selected={design.button_shape === s.id} onClick={() => set('button_shape', s.id)}>
              <span className="flex items-center gap-2">
                <span className="w-6 h-3.5 bg-zinc-800" style={{ borderRadius: RADIUS[s.id] }} />{s.label}
              </span>
            </Option>
          ))}
        </Group>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="button" onClick={save} disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition disabled:opacity-60">
            {isSaving && <Loader2 className="w-5 h-5 animate-spin" />} Guardar y seguir <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onDone} className="rounded-full px-6 py-3.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Lo hago después
          </button>
        </div>
      </div>
      <div className="md:sticky md:top-6 self-start">
        <Preview name={store?.name} design={design} />
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Logo, textos, anuncios y catálogo los ajustás después en Panel › Diseño.</p>
      </div>
    </div>
  );
}
