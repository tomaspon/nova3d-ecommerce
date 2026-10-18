// Ilustraciones de los banners de temporada. Cada objeto es un SVG chico (viewBox 0 0 100 100)
// que CampaignHero ubica alrededor del titular. Están en código, no como imágenes, para poder
// reacomodarlos según el ancho (escritorio, celular o la vista previa del panel).

/* ───────────────────────── Verano ───────────────────────── */

const Sun = () => (
  <svg viewBox="0 0 100 100">
    <g stroke="#FF8A00" strokeWidth="6" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1="50" y1="10" x2="50" y2="20" transform={`rotate(${a} 50 50)`} />
      ))}
    </g>
    <circle cx="50" cy="50" r="22" fill="#FFB000" />
    <circle cx="50" cy="50" r="22" fill="none" stroke="#FF8A00" strokeWidth="3" />
    <circle cx="43" cy="46" r="2.5" fill="#7A3E00" />
    <circle cx="57" cy="46" r="2.5" fill="#7A3E00" />
    <path d="M42 55 Q50 62 58 55" stroke="#7A3E00" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

const Sunglasses = () => (
  <svg viewBox="0 0 100 100">
    <path d="M8 40 L92 40" stroke="#E83E3E" strokeWidth="5" strokeLinecap="round" />
    <path d="M10 40 Q12 64 30 64 Q46 64 46 42 Z" fill="#1D2B53" stroke="#E83E3E" strokeWidth="4" />
    <path d="M54 42 Q54 64 70 64 Q88 64 90 40 Z" fill="#1D2B53" stroke="#E83E3E" strokeWidth="4" />
    <path d="M18 46 L26 46" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M62 46 L70 46" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
  </svg>
);

const BeachBall = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="42" fill="#FFFFFF" />
    <path d="M50 8 A42 42 0 0 1 92 50 L50 50 Z" fill="#E83E3E" />
    <path d="M50 92 A42 42 0 0 1 8 50 L50 50 Z" fill="#2D7FF9" />
    <path d="M8 50 A42 42 0 0 1 50 8 L50 50 Z" fill="#FFC21A" />
    <circle cx="50" cy="50" r="42" fill="none" stroke="#1D2B53" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="7" fill="#FFFFFF" stroke="#1D2B53" strokeWidth="2.5" />
    <path d="M24 26 Q30 20 38 18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
  </svg>
);

const Watermelon = () => (
  <svg viewBox="0 0 100 100">
    <path d="M6 30 A44 44 0 0 0 94 30 Z" fill="#2E9E45" />
    <path d="M12 30 A38 38 0 0 0 88 30 Z" fill="#F4F1C9" />
    <path d="M16 30 A34 34 0 0 0 84 30 Z" fill="#FF4D5E" />
    {[[34, 40], [50, 46], [66, 40], [42, 54], [58, 54]].map(([x, y]) => (
      <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="2.2" ry="3.4" fill="#1D2B53" />
    ))}
  </svg>
);

const Popsicle = () => (
  <svg viewBox="0 0 100 100">
    <rect x="45" y="62" width="10" height="32" rx="5" fill="#D9A066" />
    <path d="M30 20 Q30 6 50 6 Q70 6 70 20 L70 64 Q70 70 64 70 L36 70 Q30 70 30 64 Z" fill="#FF6FB1" />
    <path d="M30 40 L70 40 L70 52 L30 52 Z" fill="#FFB3D6" />
    <path d="M36 14 Q38 10 44 10" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
    <path d="M60 70 Q60 78 64 78 Q68 78 68 70" fill="#FF6FB1" />
  </svg>
);

const Starfish = ({ color = '#FF7A45' }) => (
  <svg viewBox="0 0 100 100">
    <path d="M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z" fill={color} stroke="#E0552A" strokeWidth="3" strokeLinejoin="round" />
    {[[50, 28], [50, 50], [70, 44], [30, 44], [60, 66], [40, 66]].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="#FFE2D1" />
    ))}
  </svg>
);

const Shell = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 88 L14 40 Q50 2 86 40 Z" fill="#FFE0CC" stroke="#E7A07F" strokeWidth="3" strokeLinejoin="round" />
    {[-24, -12, 0, 12, 24].map(dx => (
      <line key={dx} x1="50" y1="86" x2={50 + dx * 1.3} y2="22" stroke="#E7A07F" strokeWidth="2.5" />
    ))}
    <rect x="40" y="84" width="20" height="8" rx="3" fill="#E7A07F" />
  </svg>
);

const PalmLeaf = () => (
  <svg viewBox="0 0 100 100">
    <path d="M10 90 Q40 50 92 10" stroke="#1E7D3A" strokeWidth="4" fill="none" strokeLinecap="round" />
    {[0.15, 0.3, 0.45, 0.6, 0.75].map(t => {
      const x = 10 + 82 * t;
      const y = 90 - 80 * t;
      return (
        <g key={t}>
          <path d={`M${x} ${y} q-22 -4 -30 -20 q18 -2 30 20`} fill="#2FA556" />
          <path d={`M${x} ${y} q4 22 20 30 q2 -18 -20 -30`} fill="#27954B" />
        </g>
      );
    })}
  </svg>
);

const Lemon = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="#FFE14D" stroke="#F2B705" strokeWidth="5" />
    <circle cx="50" cy="50" r="30" fill="#FFF3A8" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
      <line key={a} x1="50" y1="50" x2="50" y2="22" stroke="#FFE14D" strokeWidth="3" transform={`rotate(${a} 50 50)`} />
    ))}
  </svg>
);

/* ───────────────────────── Primavera ───────────────────────── */

const Flower = ({ petal = '#FF8FB1', center = '#FFC93C' }) => (
  <svg viewBox="0 0 100 100">
    {[0, 72, 144, 216, 288].map(a => (
      <ellipse key={a} cx="50" cy="26" rx="16" ry="22" fill={petal} transform={`rotate(${a} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="14" fill={center} />
    <circle cx="46" cy="46" r="4" fill="#FFFFFF" opacity="0.6" />
  </svg>
);

const Daisy = () => (
  <svg viewBox="0 0 100 100">
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => (
      <ellipse key={a} cx="50" cy="22" rx="8" ry="20" fill="#FFFFFF" stroke="#E7E1D4" strokeWidth="1.5" transform={`rotate(${a} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="13" fill="#FFB800" />
  </svg>
);

const Tulip = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 52 L50 96" stroke="#3F8F4A" strokeWidth="5" strokeLinecap="round" />
    <path d="M50 82 Q30 76 26 58 Q42 62 50 78" fill="#4CAF5A" />
    <path d="M30 22 L40 34 L50 18 L60 34 L70 22 L70 42 Q70 58 50 58 Q30 58 30 42 Z" fill="#E8456F" />
    <path d="M40 34 L50 18 L60 34 Q56 50 50 52 Q44 50 40 34 Z" fill="#F26A8D" />
  </svg>
);

const Butterfly = () => (
  <svg viewBox="0 0 100 100">
    <ellipse cx="32" cy="36" rx="20" ry="24" fill="#B48BFF" transform="rotate(-20 32 36)" />
    <ellipse cx="68" cy="36" rx="20" ry="24" fill="#B48BFF" transform="rotate(20 68 36)" />
    <ellipse cx="34" cy="66" rx="14" ry="16" fill="#FF9EC7" transform="rotate(20 34 66)" />
    <ellipse cx="66" cy="66" rx="14" ry="16" fill="#FF9EC7" transform="rotate(-20 66 66)" />
    <circle cx="30" cy="34" r="5" fill="#FFFFFF" opacity="0.7" />
    <circle cx="70" cy="34" r="5" fill="#FFFFFF" opacity="0.7" />
    <rect x="47" y="24" width="6" height="56" rx="3" fill="#3A2A4D" />
    <path d="M48 26 Q42 12 36 10 M52 26 Q58 12 64 10" stroke="#3A2A4D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const Leaf = ({ color = '#5BB06A' }) => (
  <svg viewBox="0 0 100 100">
    <path d="M14 86 Q14 20 86 14 Q86 80 14 86 Z" fill={color} />
    <path d="M14 86 Q46 54 76 24" stroke="#FFFFFF" strokeWidth="3" fill="none" opacity="0.5" />
  </svg>
);

const Ladybug = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="26" r="13" fill="#1D1D1D" />
    <ellipse cx="50" cy="58" rx="32" ry="34" fill="#E53935" />
    <line x1="50" y1="26" x2="50" y2="92" stroke="#1D1D1D" strokeWidth="3" />
    {[[36, 48], [64, 48], [32, 70], [68, 70], [50, 80]].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#1D1D1D" />
    ))}
  </svg>
);

/* ───────────────────────── Invierno ───────────────────────── */

const Snowflake = ({ color = '#CFEAFF' }) => (
  <svg viewBox="0 0 100 100">
    <g stroke={color} strokeWidth="5" strokeLinecap="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map(a => (
        <g key={a} transform={`rotate(${a} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="8" />
          <polyline points="40,22 50,30 60,22" />
          <polyline points="43,12 50,18 57,12" />
        </g>
      ))}
    </g>
  </svg>
);

const Mug = () => (
  <svg viewBox="0 0 100 100">
    <path d="M36 22 Q30 14 36 6 M50 22 Q44 14 50 6 M64 22 Q58 14 64 6" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    <path d="M74 44 Q92 44 92 58 Q92 72 72 72" stroke="#E8505B" strokeWidth="7" fill="none" />
    <path d="M22 32 L78 32 L74 84 Q72 92 64 92 L36 92 Q28 92 26 84 Z" fill="#E8505B" />
    <ellipse cx="50" cy="32" rx="28" ry="6" fill="#7A4A32" />
    <rect x="34" y="26" width="10" height="9" rx="3" fill="#FFFFFF" transform="rotate(-12 39 30)" />
    <rect x="52" y="25" width="10" height="9" rx="3" fill="#FFF3F3" transform="rotate(10 57 29)" />
    <path d="M30 52 L70 52 M31 62 L69 62" stroke="#FFFFFF" strokeWidth="3" opacity="0.6" />
  </svg>
);

const Mitten = () => (
  <svg viewBox="0 0 100 100">
    <path d="M30 70 L30 30 Q30 10 50 10 Q70 10 70 30 L70 70 Z" fill="#3D7BF6" />
    <path d="M30 42 Q14 40 14 56 Q14 66 30 64" fill="#3D7BF6" />
    <rect x="26" y="70" width="48" height="20" rx="6" fill="#FFFFFF" />
    <path d="M36 32 L44 40 L52 32 L60 40" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M36 48 L44 56 L52 48 L60 56" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

const Beanie = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="14" r="10" fill="#FFFFFF" />
    <path d="M14 70 Q14 22 50 22 Q86 22 86 70 Z" fill="#F2A900" />
    <path d="M22 48 L78 48 M18 58 L82 58" stroke="#FFFFFF" strokeWidth="4" opacity="0.8" />
    <rect x="10" y="66" width="80" height="20" rx="6" fill="#E08E00" />
    <path d="M20 66 L20 86 M32 66 L32 86 M44 66 L44 86 M56 66 L56 86 M68 66 L68 86 M80 66 L80 86" stroke="#C97C00" strokeWidth="3" />
  </svg>
);

const PineBranch = () => (
  <svg viewBox="0 0 100 100">
    <path d="M8 92 Q46 56 94 8" stroke="#6B4A2E" strokeWidth="4" fill="none" strokeLinecap="round" />
    {[0.12, 0.26, 0.4, 0.54, 0.68, 0.82].map(t => {
      const x = 8 + 86 * t;
      const y = 92 - 84 * t;
      return (
        <g key={t} stroke="#2E8B57" strokeWidth="3.5" strokeLinecap="round">
          <line x1={x} y1={y} x2={x - 14} y2={y - 12} />
          <line x1={x} y1={y} x2={x + 12} y2={y + 14} />
          <line x1={x} y1={y} x2={x - 4} y2={y - 18} />
          <line x1={x} y1={y} x2={x + 18} y2={y + 4} />
        </g>
      );
    })}
    <circle cx="70" cy="40" r="6" fill="#E8505B" />
    <circle cx="78" cy="46" r="5" fill="#E8505B" />
  </svg>
);

const Gift = () => (
  <svg viewBox="0 0 100 100">
    <rect x="16" y="40" width="68" height="50" rx="4" fill="#E8505B" />
    <rect x="12" y="30" width="76" height="16" rx="4" fill="#F0636D" />
    <rect x="45" y="30" width="10" height="60" fill="#FFD166" />
    <path d="M50 30 Q34 8 26 20 Q22 30 50 30 Q78 30 74 20 Q66 8 50 30" fill="#FFD166" />
  </svg>
);

const Sparkle = ({ color = '#FFFFFF' }) => (
  <svg viewBox="0 0 100 100">
    <path d="M50 4 Q54 46 96 50 Q54 54 50 96 Q46 54 4 50 Q46 46 50 4 Z" fill={color} />
  </svg>
);

/* ───────────────────────── Composiciones ─────────────────────────
   Cada objeto: componente, posición (left/right/top en %), tamaño (en % del ancho del banner)
   y giro. "wide" se usa en anchos grandes, "narrow" en celular y vistas previas chicas.
   Los objetos rodean el centro, que queda libre para el titular. */

export const SEASON_ART = {
  verano: {
    wide: [
      { C: Sun, left: 3, top: 6, size: 10 },
      { C: Sunglasses, left: 15, top: 10, size: 9, rotate: -14 },
      { C: Starfish, left: 13, top: 52, size: 5.5, rotate: 18 },
      { C: BeachBall, left: 2, top: 50, size: 12 },
      { C: Popsicle, left: 22, top: 56, size: 7, rotate: 22 },
      { C: Shell, left: 25, top: 26, size: 4.5, rotate: -20 },
      { C: PalmLeaf, right: -1, top: -8, size: 12, rotate: 8 },
      { C: Watermelon, right: 13, top: 6, size: 11, rotate: 14 },
      { C: Lemon, right: 4, top: 44, size: 7 },
      { C: Starfish, right: 22, top: 60, size: 6, rotate: -16, props: { color: '#FF9F6B' } },
      { C: Shell, right: 26, top: 28, size: 4.5, rotate: 24 },
      { C: Popsicle, right: 12, top: 58, size: 6.5, rotate: -18 }
    ],
    narrow: [
      { C: Sun, left: 2, top: 4, size: 19 },
      { C: Watermelon, right: 2, top: 4, size: 20, rotate: 14 },
      { C: BeachBall, left: -3, top: 66, size: 22 },
      { C: Popsicle, right: 3, top: 62, size: 15, rotate: -18 }
    ]
  },
  primavera: {
    wide: [
      { C: Flower, left: 3, top: 8, size: 10 },
      { C: Butterfly, left: 17, top: 12, size: 8, rotate: -12 },
      { C: Leaf, left: 13, top: 50, size: 6, rotate: -30 },
      { C: Tulip, left: 3, top: 46, size: 11 },
      { C: Daisy, left: 22, top: 56, size: 7 },
      { C: Ladybug, left: 26, top: 30, size: 4, rotate: 20 },
      { C: Daisy, right: 4, top: 6, size: 9 },
      { C: Flower, right: 16, top: 8, size: 8, props: { petal: '#B48BFF', center: '#FFE066' } },
      { C: Tulip, right: 3, top: 44, size: 11, rotate: 6 },
      { C: Butterfly, right: 20, top: 56, size: 7, rotate: 14 },
      { C: Leaf, right: 14, top: 46, size: 6, rotate: 40, props: { color: '#7CC48A' } },
      { C: Ladybug, right: 27, top: 30, size: 4, rotate: -24 }
    ],
    narrow: [
      { C: Flower, left: 2, top: 4, size: 19 },
      { C: Butterfly, right: 3, top: 6, size: 17, rotate: 12 },
      { C: Tulip, left: -2, top: 60, size: 21 },
      { C: Daisy, right: 2, top: 64, size: 17 }
    ]
  },
  invierno: {
    wide: [
      { C: Snowflake, left: 3, top: 8, size: 9 },
      { C: Mug, left: 15, top: 12, size: 9, rotate: -8 },
      { C: Sparkle, left: 13, top: 52, size: 3.5 },
      { C: Mitten, left: 3, top: 48, size: 10, rotate: -14 },
      { C: Gift, left: 22, top: 56, size: 7, rotate: 10 },
      { C: Snowflake, left: 26, top: 28, size: 4.5, props: { color: '#8FD3FF' } },
      { C: PineBranch, right: -1, top: -6, size: 12, rotate: 6 },
      { C: Beanie, right: 14, top: 8, size: 10, rotate: 12 },
      { C: Snowflake, right: 4, top: 50, size: 8, props: { color: '#8FD3FF' } },
      { C: Mug, right: 17, top: 56, size: 8, rotate: 10 },
      { C: Sparkle, right: 26, top: 30, size: 3.5 },
      { C: Sparkle, right: 9, top: 34, size: 2.5, props: { color: '#8FD3FF' } }
    ],
    narrow: [
      { C: Snowflake, left: 3, top: 5, size: 17 },
      { C: Beanie, right: 3, top: 5, size: 18, rotate: 12 },
      { C: Mitten, left: 0, top: 62, size: 18, rotate: -14 },
      { C: Mug, right: 2, top: 62, size: 17, rotate: 10 }
    ]
  }
};
