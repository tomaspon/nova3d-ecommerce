import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import HomePage from './pages/store/HomePage';
import DashboardPage from './pages/admin/DashboardPage';
import ProductsPage from './pages/admin/ProductsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import OrdersPage from './pages/admin/OrdersPage';
import SettingsPage from './pages/admin/SettingsPage';

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          {/* RUTA PÚBLICA: STOREFRONT */}
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<HomePage />} />
          </Route>

          {/* RUTA PRIVADA: CMS DASHBOARD */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Cualquier otra URL vuelve a la tienda */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
