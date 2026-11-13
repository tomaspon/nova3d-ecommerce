import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, ExternalLink } from 'lucide-react';

// La tienda de ejemplo, funcionando, dentro de la página oficial: un iframe con la tienda
// real, en marco de computadora o de celular. Se carga recién cuando aparece en pantalla.

const DEVICES = {
  desktop: { label: 'Computadora', icon: Monitor, width: 1280, height: 800 },
  mobile: { label: 'Celular', icon: Smartphone, width: 390, height: 780 }
};

export default function DemoPreview({ url, title }) {
  const [device, setDevice] = useState('desktop');
  const [isVisible, setIsVisible] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  const boxRef = useRef(null);

  // Cargar la tienda solo cuando el visitante llega a esta sección
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // La tienda se dibuja a su tamaño real y se achica para entrar en el marco
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const spec = DEVICES[device];
  const isMobile = device === 'mobile';
  // En celular el marco es angosto; en computadora ocupa todo el ancho disponible
  const frameWidth = isMobile ? Math.min(boxWidth, 300) : boxWidth;
  const scale = frameWidth > 0 ? frameWidth / spec.width : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-full bg-white/10 p-1" role="group" aria-label="Ver como">
          {Object.entries(DEVICES).map(([id, { label, icon: Icon }]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${device === id ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:text-white'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white">
          Pantalla completa <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div ref={boxRef} className="w-full">
        <div
          className={`mx-auto overflow-hidden bg-[#FAFAFA] shadow-2xl shadow-indigo-500/10 ${isMobile ? 'rounded-[2rem] border-[8px] border-zinc-800' : 'rounded-2xl border border-white/10'}`}
          style={{ width: frameWidth || '100%' }}
        >
          {!isMobile && (
            <div className="h-8 bg-zinc-200 flex items-center gap-1.5 px-3">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" /><span className="w-2.5 h-2.5 rounded-full bg-zinc-400" /><span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
            </div>
          )}
          <div className="relative overflow-hidden" style={{ height: spec.height * scale || 320 }}>
            {isVisible && scale > 0 ? (
              <iframe
                key={device}
                src={url}
                title={title}
                loading="lazy"
                className="absolute top-0 left-0 border-0 origin-top-left"
                style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Cargando tienda…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
