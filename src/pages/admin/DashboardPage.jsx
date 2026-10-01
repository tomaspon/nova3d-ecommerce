import { DollarSign, ShoppingBag, PackageOpen, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const stats = [
    { name: 'Ventas del Mes', value: '$45,231', icon: DollarSign, trend: '+12%' },
    { name: 'Órdenes Nuevas', value: '34', icon: ShoppingBag, trend: '+5%' },
    { name: 'Stock Bajo', value: '12', icon: PackageOpen, trend: '-2%' },
    { name: 'Conversión', value: '3.2%', icon: TrendingUp, trend: '+0.4%' },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Resumen General</h1>
        <p className="text-sm md:text-base text-zinc-400">Bienvenido de vuelta. Aquí está el estado de tu tienda hoy.</p>
      </div>

      {/* Métricas Financieras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isPositive = stat.trend.startsWith('+');
          return (
            <div key={stat.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.trend}
                </span>
              </div>
              <div className="text-zinc-400 text-xs md:text-sm font-medium mb-1">{stat.name}</div>
              <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Tablas Inferiores (Placeholder Fase 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-40 md:h-96 flex flex-col items-center justify-center text-center text-sm md:text-base text-zinc-500 border-dashed">
          Módulo de Órdenes Pendientes (Próxima Fase)
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-40 md:h-96 flex flex-col items-center justify-center text-center text-sm md:text-base text-zinc-500 border-dashed">
          Módulo de Alertas de Stock (Próxima Fase)
        </div>
      </div>
    </div>
  );
}
