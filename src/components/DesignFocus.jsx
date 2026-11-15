import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { platformOrigin } from '../platformBrand';
import { smoothScrollTo } from '../smoothScroll';

// Vista previa del panel de Diseño: cuando el dueño cambia una opción, la tienda (encuadrada
// en el panel) va sola a la parte que cambia, la ilumina y oscurece el resto unos segundos.
// Las partes se marcan con data-design="..." (logo, product-card, benefits, footer...).
// Solo funciona dentro de la vista previa: en la tienda de verdad no hace nada.

// Si la parte no está a la vista (porque la opción la ocultó), se avisa por qué
const HIDDEN_NOTE = {
  benefits: 'La franja de beneficios quedó oculta.',
  'coming-soon': 'La tarjeta "Próximamente" se muestra solo cuando hay menos de 4 productos.',
  headline: 'El titular se ve cuando la oferta no ocupa la portada (Diseño › Banner de la oferta).',
  campaign: 'No hay una oferta activa: activala en Panel › Ofertas.',
  announcement: 'La barra de anuncio está apagada.',
  whatsapp: 'Para el botón de WhatsApp, cargá tu número en Configuración › Cobros.'
};

const HOLD_MS = 3200;
const isEmbedded = () => { try { return window.self !== window.top; } catch { return true; } };

function pick(target) {
  if (target === 'product-card-offer') {
    return document.querySelector('[data-design="product-card"][data-offer="true"]') || document.querySelector('[data-design="product-card"]');
  }
  return document.querySelector(`[data-design="${target}"]`);
}

export default function DesignFocus() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const [focus, setFocus] = useState(null); // { el, rect } | { note }
  const timer = useRef(null);
  const frame = useRef(null);

  useEffect(() => {
    if (!isEmbedded()) return;
    const run = (target) => {
      clearTimeout(timer.current);
      document.querySelectorAll('[data-design-active]').forEach(n => n.removeAttribute('data-design-active'));
      if (!target || target === 'page') {
        smoothScrollTo(0);
        setFocus(null);
        return;
      }
      const el = pick(target);
      if (!el) {
        setFocus({ note: HIDDEN_NOTE[target] || 'Con esta opción, esa parte no se muestra.' });
        timer.current = setTimeout(() => setFocus(null), HOLD_MS);
        return;
      }
      el.setAttribute('data-design-active', ''); // muestra lo que normalmente aparece al pasar el mouse
      const r = el.getBoundingClientRect();
      const visible = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!visible) {
        // Centrada en la pantalla (o desde arriba, si es más alta que la pantalla)
        const offset = r.height > window.innerHeight * 0.8 ? 80 : (window.innerHeight - r.height) / 2;
        smoothScrollTo(r.top + window.scrollY - offset);
      }
      setFocus({ el });
      timer.current = setTimeout(() => {
        el.removeAttribute('data-design-active');
        setFocus(null);
      }, HOLD_MS);
    };

    const onMessage = (event) => {
      if (![window.location.origin, platformOrigin()].includes(event.origin) || event.data?.type !== 'store-design-focus') return;
      const { target } = event.data;
      const wantsAbout = target === 'about';
      const path = pathRef.current;
      // La parte está en otra página de la tienda: primero se va ahí
      if (wantsAbout && path !== '/nosotros') navigate('/nosotros');
      else if (!wantsAbout && path !== '/') navigate('/');
      else { setTimeout(() => run(target), 120); return; } // espera a que se dibuje el cambio
      setTimeout(() => run(target), 450);
    };
    window.addEventListener('message', onMessage);
    return () => { window.removeEventListener('message', onMessage); clearTimeout(timer.current); };
  }, [navigate]);

  // Mientras se ilumina, el recuadro sigue a la parte (el deslizamiento la mueve)
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!focus?.el) { setRect(null); return; }
    const tick = () => {
      const r = focus.el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      frame.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame.current);
  }, [focus]);

  if (!focus) return null;
  if (focus.note) {
    return (
      <div className="fixed inset-x-0 top-4 z-[200] flex justify-center pointer-events-none px-4">
        <p className="rounded-full bg-zinc-900 text-white text-sm font-semibold px-4 py-2 shadow-2xl">{focus.note}</p>
      </div>
    );
  }
  if (!rect) return null;
  const pad = 8;
  return (
    <div aria-hidden="true" className="fixed z-[200] pointer-events-none rounded-2xl transition-[top,left,width,height] duration-150"
      style={{
        top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
        boxShadow: '0 0 0 3px #6366f1, 0 0 0 9999px rgba(0,0,0,0.45)'
      }}>
      <span className="absolute -top-3 left-3 rounded-full bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 shadow">Esto cambia</span>
    </div>
  );
}
