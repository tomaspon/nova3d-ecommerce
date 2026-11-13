import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, Truck, LayoutDashboard, Globe, Smartphone, Package, MessageCircle, Check } from 'lucide-react';
import { PLATFORM_BRAND, PLATFORM_DOMAIN } from '../../platformBrand';
import { SUPPORT_WHATSAPP } from '../../storeContact';
import { storeUrls } from '../../platformStores';
import StoreRequestForm from './StoreRequestForm';
import DemoPreview from './DemoPreview';

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

const EXAMPLE_STORE = { slug: 'demo', custom_domain: null };

export default function PlatformHome() {
  useEffect(() => {
    document.title = `${PLATFORM_BRAND.name} | ${PLATFORM_BRAND.tagline}`;
  }, []);
  const exampleUrl = storeUrls(EXAMPLE_STORE, { origin: window.location.origin, platformDomain: PLATFORM_DOMAIN || null }).storefront;
  const contactUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`¡Hola! Quiero mi tienda online con ${PLATFORM_BRAND.name}.`)}`;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-600">.</span></span>
          <nav className="flex items-center gap-2 sm:gap-6 text-sm font-semibold">
            <a href="#como-funciona" className="hidden sm:inline text-zinc-500 hover:text-zinc-900">Cómo funciona</a>
            <a href="#ejemplo" className="hidden sm:inline text-zinc-500 hover:text-zinc-900">Ejemplo</a>
            <a href="#solicitar" className="rounded-full bg-zinc-900 text-white px-4 py-2 hover:bg-zinc-700 transition">Quiero mi tienda</a>
          </nav>
        </div>
      </header>

      {/* Presentación */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 md:pt-24 md:pb-20">
        <p className="text-sm font-semibold text-indigo-600 mb-4">Tiendas online para emprendedores</p>
        <h1 className="text-[clamp(2.4rem,6vw,4.75rem)] font-extrabold tracking-[-0.035em] leading-[1.02] max-w-3xl">
          {PLATFORM_BRAND.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600 leading-relaxed">
          Catálogo, cobros con MercadoPago, envíos y un panel para manejar todo. Vos te ocupás de vender; nosotros, de la tecnología.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="#solicitar" className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-7 py-4 hover:bg-indigo-500 transition">
            Solicitar mi tienda <ArrowRight className="w-4 h-4" />
          </a>
          <a href="#ejemplo" className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 font-bold px-7 py-4 hover:bg-zinc-50 transition">
            Ver una tienda de ejemplo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Ejemplo real */}
      <section id="ejemplo" className="bg-zinc-950 text-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-6 md:items-end mb-10">
            <div>
              <p className="text-sm font-semibold text-indigo-400 mb-3">Tienda de ejemplo · probala acá mismo</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">NORTE.</h2>
              <p className="mt-4 text-zinc-400 leading-relaxed max-w-xl">
                Así se ve una marca de ropa en {PLATFORM_BRAND.name}. Recorrela como si fueras un cliente: mirá productos, ofertas y el carrito, en computadora o en celular.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-zinc-300">
              {['Banners de temporada listos para usar', 'Stock reservado mientras el cliente paga', 'Seguimiento del pedido para el comprador'].map(item => (
                <li key={item} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {item}</li>
              ))}
            </ul>
          </div>
          <DemoPreview url={exampleUrl} title="Tienda de ejemplo NORTE." />
        </div>
      </section>

      {/* Qué incluye */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-xl">Todo lo que necesitás para vender online</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></span>
              <h3 className="mt-4 font-bold text-lg">{title}</h3>
              <p className="mt-1.5 text-zinc-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="bg-zinc-50 border-y border-zinc-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Cómo funciona</h2>
          <ol className="mt-10 grid md:grid-cols-3 gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-white rounded-2xl border border-zinc-200 p-6">
                <span className="text-sm font-extrabold text-indigo-600">0{index + 1}</span>
                <h3 className="mt-3 font-bold text-lg">{step.title}</h3>
                <p className="mt-1.5 text-zinc-600 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Solicitud */}
      <section id="solicitar" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-10">
        <div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">¿Arrancamos tu tienda?</h2>
          <p className="mt-4 text-zinc-600 text-lg leading-relaxed">Completá tus datos y te mandamos el presupuesto. En pocos días estás vendiendo.</p>
          <p className="mt-6 text-sm text-zinc-500">¿Preferís hablar primero?</p>
          <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 font-bold text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900">
            <MessageCircle className="w-5 h-5" /> Escribinos por WhatsApp
          </a>
        </div>
        <StoreRequestForm />
      </section>

      <footer className="border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 justify-between text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} {PLATFORM_BRAND.name}</p>
          <Link to="/plataforma" className="hover:text-zinc-900">Acceso administradores</Link>
        </div>
      </footer>
    </div>
  );
}
