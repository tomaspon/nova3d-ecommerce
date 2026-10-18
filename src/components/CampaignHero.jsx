import { SEASON_ART } from './campaignArt';

const SCRIPT_FONT = "'Pacifico', cursive";

// Banner de campaña ilustrado. Es HTML + SVG (no una imagen): el texto siempre se lee entero
// y todo escala con el ancho del contenedor (unidades cqw), así sirve igual en la portada,
// en celular y en la vista previa del panel.
//
// - title: nombre de la campaña. La primera parte va en mayúsculas y la última palabra en letra
//   script ("SUMMER" + "Sale").
// - maxDiscount: el mayor descuento real entre los productos de la campaña (0 = no se muestra).
// - onCtaClick: si no se pasa, el botón se muestra sin acción (vista previa).
export default function CampaignHero({ preset, title, maxDiscount = 0, productCount = 0, onCtaClick, as: Heading = 'h2' }) {
  const { colors } = preset;
  const art = SEASON_ART[preset.id];
  const words = (title || preset.defaultTitle).trim().split(/\s+/);
  const scriptWord = words.length > 1 ? words.pop() : null;
  const mainWords = words.join(' ');

  const offer = maxDiscount > 0 ? `${productCount > 1 ? 'Hasta ' : ''}${maxDiscount}% OFF` : null;

  const renderArt = (items) => items.map(({ C, left, right, top, size, rotate = 0, props }, index) => (
    <div
      key={index}
      className="absolute"
      style={{
        left: left !== undefined ? `${left}%` : undefined,
        right: right !== undefined ? `${right}%` : undefined,
        top: `${top}%`,
        width: `${size}cqw`,
        transform: `rotate(${rotate}deg)`,
        filter: 'drop-shadow(0 0.6cqw 0.8cqw rgba(0,0,0,0.18))'
      }}
    >
      <C {...props} />
    </div>
  ));

  return (
    <div
      className="@container relative w-full h-full overflow-hidden select-none"
      style={{
        backgroundColor: colors.bg,
        // Brillo detrás del titular + papel picado sutil
        backgroundImage: `radial-gradient(ellipse at center, ${colors.glow} 0%, transparent 60%), radial-gradient(${colors.confetti} 1.5px, transparent 1.6px)`,
        backgroundSize: '100% 100%, 22px 22px'
      }}
    >
      {/* Ilustraciones: composición completa en anchos grandes, cuatro esquinas en chicos */}
      <div className="absolute inset-0 hidden @2xl:block" aria-hidden="true">{renderArt(art.wide)}</div>
      <div className="absolute inset-0 @2xl:hidden" aria-hidden="true">{renderArt(art.narrow)}</div>

      {/* Texto centrado */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-[18cqw] @2xl:px-[30cqw]">
        <p
          className="leading-none -rotate-3"
          style={{ fontFamily: SCRIPT_FONT, color: colors.script, fontSize: 'clamp(15px, 2.4cqw, 36px)' }}
        >
          {preset.kicker}
        </p>

        <Heading className="mt-[0.6cqw] leading-none">
          <span
            className="block font-black uppercase tracking-tighter"
            style={{ color: colors.title, fontSize: 'clamp(30px, 6.2cqw, 96px)', lineHeight: 0.95 }}
          >
            {mainWords}
          </span>
          {scriptWord && (
            <span
              className="block -rotate-3 -mt-[0.4cqw]"
              style={{ fontFamily: SCRIPT_FONT, color: colors.script, fontSize: 'clamp(28px, 5.2cqw, 80px)', lineHeight: 1.1 }}
            >
              {scriptWord}
            </span>
          )}
        </Heading>

        {offer && (
          <p
            className="mt-[0.8cqw] font-black uppercase tracking-tight"
            style={{ color: colors.offer, fontSize: 'clamp(14px, 2cqw, 30px)' }}
          >
            {offer}
          </p>
        )}

        <button
          type="button"
          onClick={onCtaClick}
          tabIndex={onCtaClick ? 0 : -1}
          className="mt-[1.4cqw] rounded-full font-bold uppercase tracking-wider shadow-lg transition hover:scale-105"
          style={{
            backgroundColor: colors.ctaBg,
            color: colors.ctaText,
            fontSize: 'clamp(11px, 1.3cqw, 18px)',
            padding: 'clamp(7px, 0.9cqw, 14px) clamp(16px, 2.4cqw, 36px)'
          }}
        >
          Comprar ahora
        </button>
      </div>
    </div>
  );
}
