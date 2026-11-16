import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Modo día / noche de la página oficial (inicio, crear tienda, términos).
// Es una preferencia aparte de la de las tiendas: cambiarla acá no toca cómo se ve ninguna tienda.
// Si la persona nunca eligió, se sigue el modo de su sistema (y cambia solo si el sistema cambia).

export const PLATFORM_THEME_KEY = 'vitrina_tema';

const systemPrefersDark = () => Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);

function savedTheme() {
  try {
    const value = localStorage.getItem(PLATFORM_THEME_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function initialPlatformTheme() {
  return savedTheme() || (systemPrefersDark() ? 'dark' : 'light');
}

export function usePlatformTheme() {
  const [theme, setTheme] = useState(initialPlatformTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    // Al salir de estas páginas (panel, tiendas) no queda el modo puesto
    return () => { root.classList.remove('dark'); root.style.colorScheme = ''; };
  }, [theme]);

  // Sin elección propia, acompaña al sistema
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media?.addEventListener) return undefined;
    const onChange = (event) => { if (!savedTheme()) setTheme(event.matches ? 'dark' : 'light'); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => setTheme(current => {
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(PLATFORM_THEME_KEY, next); } catch { /* sin almacenamiento: dura hasta recargar */ }
    return next;
  });

  return [theme, toggle];
}

export default function ThemeToggle({ className = '' }) {
  const [theme, toggle] = usePlatformTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Pasar a modo día' : 'Pasar a modo noche'}
      title={dark ? 'Modo día' : 'Modo noche'}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition ${className}`}
    >
      {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}
