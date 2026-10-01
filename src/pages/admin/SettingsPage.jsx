import { HardDrive, Package, Tag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export default function SettingsPage() {
  const { products, categories } = useStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Configuración</h1>
        <p className="text-zinc-400 text-sm">Estado de la tienda y de sus datos.</p>
      </div>

      {/* ── ALMACENAMIENTO ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-yellow-500/20 text-yellow-400 rounded-lg flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white mb-1">Datos guardados en este navegador</div>
            <p className="text-sm text-zinc-400">
              Los productos y categorías se guardan solo en este dispositivo. Otros visitantes no los ven hasta que la tienda se conecte a una base de datos.
            </p>
          </div>
        </div>
      </div>

      {/* ── RESUMEN DE DATOS ── */}
      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center mb-3 md:mb-4">
            <Package className="w-5 h-5" />
          </div>
          <div className="text-zinc-400 text-xs md:text-sm font-medium mb-1">Productos</div>
          <div className="text-2xl md:text-3xl font-black text-white">{products.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center mb-3 md:mb-4">
            <Tag className="w-5 h-5" />
          </div>
          <div className="text-zinc-400 text-xs md:text-sm font-medium mb-1">Categorías</div>
          <div className="text-2xl md:text-3xl font-black text-white">{categories.length}</div>
        </div>
      </div>
    </div>
  );
}
