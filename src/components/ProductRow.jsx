import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';

// Fila de productos que se desliza de costado: "Volvé a lo que viste", "Elegidos para vos"...
export default function ProductRow({ title, hint, products, onClear, design = 'for-you', className = '' }) {
  const navigate = useNavigate();
  if (!products?.length) return null;

  return (
    <section data-design={design} className={`min-w-0 ${className}`} aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{title}</h2>
          {hint && <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{hint}</p>}
        </div>
        {onClear && (
          <button type="button" onClick={onClear} className="shrink-0 min-h-10 px-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-600">
            Borrar historial
          </button>
        )}
      </div>
      <ul className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 custom-scrollbar snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        {products.map(p => {
          const finalPrice = p.price * (1 - (Number(p.discount) || 0) / 100);
          const soldOut = (p.available_stock ?? p.stock) <= 0;
          return (
            <li key={p.id} className="w-32 sm:w-40 md:w-44 shrink-0 snap-start">
              <button type="button" onClick={() => navigate(`/producto/${p.id}`)} className="group block w-full text-left">
                <div className="aspect-[var(--card-aspect)] bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl relative overflow-hidden mb-2.5 border border-zinc-100 dark:border-white/5">
                  {p.imageUrl ? (
                    <img loading="lazy" decoding="async" src={p.imageUrl} alt="" className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${soldOut ? 'opacity-60' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-zinc-300 dark:text-zinc-700" /></div>
                  )}
                  {soldOut ? (
                    <span className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-[8px] font-black tracking-widest uppercase">Agotado</span>
                  ) : p.discount > 0 && (
                    <span className="absolute top-2 left-2 bg-accent text-accent-ink px-2 py-1 rounded-md text-[8px] md:text-[9px] font-black tracking-widest">{p.discount}% OFF</span>
                  )}
                </div>
                <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm truncate group-hover:underline underline-offset-4">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="font-black text-zinc-900 dark:text-white text-sm">${finalPrice.toLocaleString('es-AR')}</span>
                  {p.discount > 0 && <span className="text-[10px] text-zinc-400 line-through">${p.price.toLocaleString('es-AR')}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
