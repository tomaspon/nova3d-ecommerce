import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, ExternalLink, Lock, MousePointerClick, RotateCw } from 'lucide-react';

// La tienda de ejemplo, funcionando, dentro de la página oficial: un iframe con la tienda
// real, en marco de computadora o de celular.

const DEVICES = {
  // Alto pensado para que se vea el banner, las ofertas y el comienzo del catálogo
  desktop: { label: 'Computadora', icon: Monitor, width: 1600, height: 1120 },
  mobile: { label: 'Celular', icon: Smartphone, width: 390, height: 844 }
};

const PHONE_WIDTH = 270;
const DESKTOP_MAX_WIDTH = 900;

export default function DemoPreview({ url, title }) {
  // La barra de dirección muestra la dirección real (sin "https://") y lleva a la tienda
  const displayUrl = url.replace(/^https?:\/\//, '');
  // En el celular del visitante, la vista de computadora quedaría diminuta
  const [device, setDevice] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'));
  const [boxWidth, setBoxWidth] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const boxRef = useRef(null);
  const iframeRef = useRef(null);

  // La tienda se dibuja a su tamaño real y se achica para entrar en el marco
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tocar dentro del iframe le saca el foco a esta página: así sabemos que ya la está usando
  useEffect(() => {
    const onBlur = () => {
      if (document.activeElement === iframeRef.current) setHasInteracted(true);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const spec = DEVICES[device];
  const isMobile = device === 'mobile';
  const screenWidth = Math.min(boxWidth, isMobile ? PHONE_WIDTH : DESKTOP_MAX_WIDTH);
  const scale = screenWidth > 0 ? screenWidth / spec.width : 0;
  const screenHeight = spec.height * scale;

  // loading="lazy": el navegador la carga recién cuando el visitante se acerca a la sección
  const iframe = scale > 0 ? (
    <iframe
      ref={iframeRef}
      key={`${device}-${reloadKey}`}
      src={url}
      title={title}
      loading="lazy"
      className="absolute top-0 left-0 border-0 origin-top-left bg-[#FAFAFA]"
      style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 bg-[#FAFAFA]">Cargando tienda…</div>
  );

  const hint = !hasInteracted && (
    <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur animate-in fade-in duration-500">
      <MousePointerClick className="w-4 h-4" /> Probala: tocá un producto o el carrito
    </div>
  );

  return (
    <div>
      {/* Controles */}
      <div className="mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-3 mb-6" style={{ maxWidth: DESKTOP_MAX_WIDTH }}>
        <div className="inline-flex rounded-full bg-white/[0.06] border border-white/10 p-1" role="group" aria-label="Ver como">
          {Object.entries(DEVICES).map(([id, { label, icon: Icon }]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${device === id ? 'bg-white text-zinc-900 shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setReloadKey(k => k + 1)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition">
            <RotateCw className="w-4 h-4" /> Reiniciar
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition">
            Pantalla completa <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div ref={boxRef} className="relative w-full">
        {/* Resplandor detrás del dispositivo */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25),transparent_65%)] blur-2xl" />

        {isMobile ? (
          // Teléfono: bisel, isla y botones laterales
          <div className="relative mx-auto" style={{ width: screenWidth + 24 }}>
            <span aria-hidden="true" className="absolute -left-[3px] top-28 h-12 w-[3px] rounded-l bg-zinc-700" />
            <span aria-hidden="true" className="absolute -left-[3px] top-44 h-16 w-[3px] rounded-l bg-zinc-700" />
            <span aria-hidden="true" className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-zinc-700" />
            <div className="rounded-[2.75rem] bg-zinc-900 p-3 ring-1 ring-white/15 shadow-2xl shadow-black/60">
              <div className="overflow-hidden rounded-[2.1rem] bg-[#FAFAFA]">
                {/* Barra de estado: la isla no tapa la tienda */}
                <div aria-hidden="true" className="relative h-9 flex items-center justify-between px-6 text-[11px] font-semibold text-zinc-900">
                  <span>9:41</span>
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-24 rounded-full bg-zinc-900" />
                  <span className="flex items-end gap-0.5">
                    <span className="w-0.5 h-1.5 rounded-sm bg-zinc-900" /><span className="w-0.5 h-2 rounded-sm bg-zinc-900" /><span className="w-0.5 h-2.5 rounded-sm bg-zinc-900" />
                    <span className="ml-1 w-5 h-2.5 rounded-[3px] border border-zinc-900 p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-zinc-900" /></span>
                  </span>
                </div>
                <div className="relative overflow-hidden" style={{ height: screenHeight || 600 }}>
                  {iframe}
                  {hint}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Ventana de navegador con la dirección de la tienda
          <div className="relative mx-auto overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl shadow-black/60 bg-zinc-900" style={{ width: screenWidth || '100%', maxWidth: '100%' }}>
            <div className="h-11 flex items-center gap-4 px-4 bg-zinc-900 border-b border-white/5">
              <div className="flex gap-2" aria-hidden="true">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 flex justify-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir la tienda de ejemplo en otra pestaña"
                  className="inline-flex items-center gap-2 max-w-full rounded-lg bg-white/[0.06] hover:bg-white/10 px-4 py-1.5 text-xs text-zinc-300 hover:text-white transition"
                >
                  <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="truncate">{displayUrl}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0" />
                </a>
              </div>
              <div className="w-[52px]" aria-hidden="true" />
            </div>
            <div className="relative overflow-hidden" style={{ height: screenHeight || 500 }}>
              {iframe}
              {hint}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
