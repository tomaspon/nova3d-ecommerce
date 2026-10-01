import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import HomePage from './pages/store/HomePage';
import AboutPage from './pages/store/AboutPage';
import TrackingPage from './pages/store/TrackingPage';
import LoginPage from './pages/store/LoginPage';
import ProfilePage from './pages/store/ProfilePage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import DashboardPage from './pages/admin/DashboardPage';
import ProductsPage from './pages/admin/ProductsPage';
import OrdersPage from './pages/admin/OrdersPage';
import ShippingPage from './pages/admin/ShippingPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import SettingsPage from './pages/admin/SettingsPage';
import AdminAuth from './components/AdminAuth';

function App() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          {/* RUTA PÚBLICA: STOREFRONT */}
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="producto/:id" element={<ProductDetailPage />} />
            <Route path="nosotros" element={<AboutPage />} />
            <Route path="seguimiento" element={<TrackingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>

          {/* RUTA PRIVADA: CMS DASHBOARD */}
          <Route path="/admin" element={<AdminAuth><AdminLayout /></AdminAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
