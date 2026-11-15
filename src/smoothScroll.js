// Deslizamiento suave de la página hasta una altura. Es propio (no el "smooth" del navegador)
// para que se vea igual en todos lados. Quien pidió menos movimiento en su sistema va directo.
let current = null;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function smoothScrollTo(top, { onDone } = {}) {
  const start = window.scrollY;
  const end = Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
  if (current) cancelAnimationFrame(current);

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || Math.abs(end - start) < 2) {
    window.scrollTo(0, end);
    onDone?.();
    return;
  }

  // Más lejos, un poco más de tiempo (entre 0,45 y 0,85 s), con arranque y frenado suaves
  const duration = Math.min(850, Math.max(450, Math.abs(end - start) * 0.35));
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + (end - start) * ease(t));
    if (t < 1) current = requestAnimationFrame(step);
    else { current = null; onDone?.(); }
  };
  current = requestAnimationFrame(step);
}
