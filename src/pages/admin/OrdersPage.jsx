import { Box } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Órdenes</h1>
        <p className="text-zinc-400 text-sm">Acá vas a ver las compras que hagan tus clientes.</p>
      </div>

      <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl px-6 py-16 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-4">
          <Box className="w-6 h-6" />
        </div>
        <div className="font-bold text-white mb-1">Todavía no hay órdenes</div>
        <p className="text-sm text-zinc-500 max-w-sm">
          La tienda aún no tiene el pago habilitado, así que no se registran compras. Las órdenes van a aparecer acá cuando se active el checkout.
        </p>
      </div>
    </div>
  );
}
