import { useStore } from '../../context/StoreContext';
import TrafficPage from '../platform/TrafficPage';

// Panel › Estadísticas: el tráfico de esta tienda (la misma vista del superadmin, solo la suya)
export default function StatsPage() {
  const { storeId } = useStore();
  if (!storeId) return null;
  return <TrafficPage storeId={storeId} />;
}
