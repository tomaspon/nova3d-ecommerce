import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, MessageCircle, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

// "Nosotros" genérica: sirve para cualquier tienda de la plataforma. Cada tienda puede
// reemplazar el título y el texto con su propia historia (branding.about_title / about_text).

const VALUES = [
  { icon: Sparkles, title: 'Cuidamos cada detalle', text: 'Elegimos y revisamos cada producto antes de que llegue a tus manos.' },
  { icon: ShieldCheck, title: 'Comprá con tranquilidad', text: 'Pagás con MercadoPago o transferencia y seguís tu pedido online en todo momento.' },
  { icon: MessageCircle, title: 'Atención de persona a persona', text: 'Si tenés una duda antes o después de comprar, te respondemos nosotros, no un robot.' }
];

export default function AboutPage() {
  const { store } = useStore();
  const name = store?.name || '';
  const branding = store?.branding || {};

  const title = branding.about_title || `Conocé ${name}`;
  const text = branding.about_text
    || 'Somos una marca que vende sus productos online. Cada pedido lo preparamos con dedicación y te acompañamos desde que comprás hasta que lo recibís.';

  return (
    <div className="bg-white dark:bg-zinc-950 min-h-[calc(100vh-6rem)]">
      <section className="bg-[#f4f4f5] dark:bg-zinc-900 px-4 sm:px-8 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.25em] mb-4">Nosotros</p>
          <h1 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter">{title}</h1>
          <p className="mt-6 text-lg md:text-xl text-zinc-500 leading-relaxed whitespace-pre-line">{text}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map(({ icon: Icon, title: valueTitle, text: valueText }) => (
            <div key={valueTitle} className="rounded-3xl border border-zinc-200 dark:border-white/10 p-6 md:p-8">
              <span className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                <Icon className="w-5 h-5 text-zinc-900 dark:text-white" />
              </span>
              <h2 className="mt-5 text-lg font-black text-zinc-900 dark:text-white tracking-tight">{valueTitle}</h2>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{valueText}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-ink font-bold px-7 py-4 hover:opacity-85 transition">
            Ver productos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
