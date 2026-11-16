import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ArrowRight, CreditCard, Truck, LayoutDashboard, Globe, Smartphone, Package, MessageCircle, Check, ChevronDown } from 'lucide-react';
import { PLATFORM_BRAND, PLATFORM_DOMAIN, storesOrigin } from '../../platformBrand';
import { SUPPORT_WHATSAPP } from '../../storeContact';
import { storeUrls } from '../../platformStores';
import StoreRequestForm from './StoreRequestForm';
import DemoPreview from './DemoPreview';
import ThemeToggle from '../../components/ThemeToggle';

// Página oficial de la plataforma: ofrece tiendas online y muestra funcionando la tienda
// de ejemplo NORTE. (enlace "demo", supabase/004_tienda_demo.sql).

const FEATURES = [
  { icon: Package, title: 'Catálogo y stock', text: 'Cargá productos con fotos, precios y ofertas. El stock se descuenta solo con cada venta.' },
  { icon: CreditCard, title: 'Cobros con MercadoPago', text: 'Tus clientes pagan con tarjeta, débito o transferencia, con la seguridad de MercadoPago.' },
  { icon: Truck, title: 'Envíos y seguimiento', text: 'Despachá desde el panel y tus clientes siguen su pedido online, paso a paso.' },
  { icon: LayoutDashboard, title: 'Panel simple', text: 'Ventas, pedidos, inventario y campañas en un solo lugar, desde la compu o el celular.' },
  { icon: Globe, title: 'Tu propio dominio', text: 'Tu tienda en tunombre.com.ar, con tu marca.' },
  { icon: Smartphone, title: 'Pensada para celular', text: 'La mayoría compra desde el teléfono: tu tienda se ve impecable ahí.' }
];

const STEPS = [
  { title: 'Contanos de tu negocio', text: 'Ropa, velas, accesorios o lo que vendas: elegimos el estilo para tu rubro.' },
  { title: 'Cargá tus productos', text: 'Desde tu panel subís fotos, precios y stock. Te dejamos un manual paso a paso.' },
  { title: 'Empezá a vender', text: 'Conectamos tu dominio y tus cobros. Compartís el link y listo.' }
];

// La tienda de muestra es la plantilla base (MINIMAL): lo que se ve es lo que recibe cada tienda nueva
const EXAMPLE_STORE = { slug: 'minimal', custom_domain: null };

// Los enlaces internos (#ejemplo, #como-funciona) deslizan hasta la sección en vez de saltar.
// Quien pidió menos movimiento en su sistema va directo.
const HEADER_OFFSET = 64; // alto del encabezado fijo
let scrollAnimation = null;

function scrollToSection(event) {
  const id = event.currentTarget.getAttribute('href')?.slice(1);
  const target = id && document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  window.history.replaceState(null, '', `#${id}`);

  const start = window.scrollY;
  const end = Math.max(0, target.getBoundingClientRect().top + start - HEADER_OFFSET);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || Math.abs(end - start) < 2) { window.scrollTo(0, end); return; }

  // Más lejos, un poco más de tiempo (entre 0,5 y 0,9 s), con arranque y frenado suaves
  const duration = Math.min(900, Math.max(500, Math.abs(end - start) * 0.35));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  if (scrollAnimation) cancelAnimationFrame(scrollAnimation);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + (end - start) * ease(t));
    scrollAnimation = t < 1 ? requestAnimationFrame(step) : null;
  };
  scrollAnimation = requestAnimationFrame(step);
}

export default function PlatformHome() {
  useEffect(() => {
    document.title = `${PLATFORM_BRAND.name} | ${PLATFORM_BRAND.tagline}`;
  }, []);
  // La tienda de ejemplo se ve en la dirección de las tiendas (en la de la plataforma, / es esta página)
  const exampleUrl = storeUrls(EXAMPLE_STORE, { origin: storesOrigin() || window.location.origin, platformDomain: PLATFORM_DOMAIN || null }).storefront;
  const [showRequest, setShowRequest] = useState(false);
  const contactUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`¡Hola! Quiero mi tienda online con ${PLATFORM_BRAND.name}.`)}`;

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-zinc-200 dark:bg-zinc-950/85 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-600 dark:text-indigo-400">.</span></span>
          <nav className="flex items-center gap-1.5 sm:gap-6 text-sm font-semibold">
            <a href="#como-funciona" onClick={scrollToSection} className="hidden sm:inline text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Cómo funciona</a>
            <a href="#ejemplo" onClick={scrollToSection} className="hidden sm:inline text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Ejemplo</a>
            <Link to="/ingresar" className="hidden sm:inline text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Ingresar</Link>
            <ThemeToggle className="-mx-1 sm:mx-0" />
            <Link to="/crear" className="rounded-full bg-zinc-900 text-white px-4 py-2 hover:bg-zinc-700 transition dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">Creá tu tienda</Link>
          </nav>
        </div>
      </header>

      {/* Presentación */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 md:pt-24 md:pb-20">
        <p className="text-sm font-semibold text-indigo-600 mb-4 dark:text-indigo-400">Tiendas online para emprendedores</p>
        <h1 className="text-[clamp(2.4rem,6vw,4.75rem)] font-extrabold tracking-[-0.035em] leading-[1.02] max-w-3xl">
          {PLATFORM_BRAND.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600 leading-relaxed dark:text-zinc-400">
          Catálogo, cobros con MercadoPago, envíos y un panel para manejar todo. Vos te ocupás de vender; nosotros, de la tecnología.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link to="/crear" className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-7 py-4 hover:bg-indigo-500 transition">
            Creá tu tienda gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#ejemplo" onClick={scrollToSection} className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 font-bold px-7 py-4 hover:bg-zinc-50 transition dark:border-white/15 dark:hover:bg-white/5">
            Ver una tienda de ejemplo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="bg-zinc-50 border-y border-zinc-200 scroll-mt-16 dark:bg-zinc-900 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Cómo funciona</h2>
          <p className="mt-3 text-zinc-600 text-lg dark:text-zinc-400">Tres pasos y estás vendiendo. Abajo tenés una tienda de ejemplo para probar.</p>
          <ol className="mt-10 grid md:grid-cols-3 gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-white rounded-2xl border border-zinc-200 p-6 dark:bg-zinc-950 dark:border-white/10">
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">0{index + 1}</span>
                <h3 className="mt-3 font-bold text-lg">{step.title}</h3>
                <p className="mt-1.5 text-zinc-600 leading-relaxed dark:text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Ejemplo real */}
      <section id="ejemplo" className="relative overflow-hidden bg-zinc-950 text-white scroll-mt-16 dark:bg-black dark:border-y dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Tienda de ejemplo en vivo
            </p>
            <h2 className="mt-5 text-3xl md:text-5xl font-extrabold tracking-tight">Probala como si fueras un cliente</h2>
            <p className="mt-4 text-zinc-400 md:text-lg leading-relaxed">
              MINIMAL. es una tienda de ropa armada con {PLATFORM_BRAND.name}, igual a la que vas a recibir. Mirá productos, ofertas y el carrito, en computadora o en celular.
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2">
              {['Banners de temporada', 'Stock reservado mientras pagan', 'Seguimiento de pedidos'].map(item => (
                <li key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <DemoPreview url={exampleUrl} title="Tienda de ejemplo MINIMAL." />
        </div>
      </section>

      {/* Qué incluye */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-xl">Todo lo que necesitás para vender online</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center dark:bg-indigo-500/15 dark:text-indigo-400"><Icon className="w-5 h-5" /></span>
              <h3 className="mt-4 font-bold text-lg">{title}</h3>
              <p className="mt-1.5 text-zinc-600 leading-relaxed dark:text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solicitud */}
      {/* El formulario de presupuesto queda plegado: lo principal es crear la tienda */}
      <section id="solicitar" className="scroll-mt-16 max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">¿Arrancamos tu tienda?</h2>
        <p className="mt-4 text-zinc-600 text-lg leading-relaxed dark:text-zinc-400">Creala vos en 2 minutos, gratis. Cargás tus productos y cuando esté lista te habilitamos las ventas.</p>
        <Link to="/crear" className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-7 py-4 hover:bg-indigo-500 transition">
          <Sparkles className="w-5 h-5" /> Creá tu tienda gratis
        </Link>

        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 text-left dark:border-white/10 dark:bg-zinc-900">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-zinc-900 dark:text-white">¿Preferís que te la armemos nosotros?</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                Dejanos tus datos y te mandamos un presupuesto, o{' '}
                <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white">
                  <MessageCircle className="w-4 h-4" /> escribinos por WhatsApp
                </a>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRequest(open => !open)}
              aria-expanded={showRequest}
              aria-controls="pedido-presupuesto"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-bold hover:bg-zinc-100 transition dark:border-white/15 dark:bg-zinc-950 dark:hover:bg-white/10"
            >
              {showRequest ? 'Ocultar' : 'Pedir presupuesto'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showRequest ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showRequest && (
            <div id="pedido-presupuesto" className="border-t border-zinc-200 p-3 sm:p-4 dark:border-white/10">
              <StoreRequestForm />
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} {PLATFORM_BRAND.name}</p>
          <Link to="/ingresar" className="hover:text-zinc-900 dark:hover:text-white">Ingresar a mi tienda</Link>
        </div>
      </footer>
    </div>
  );
}
