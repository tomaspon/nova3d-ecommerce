import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';

// Layouts
import StoreLayout from './layouts/StoreLayout';

// Pages
import HomePage from './pages/store/HomePage';
import AboutPage from './pages/store/AboutPage';
import TrackingPage from './pages/store/TrackingPage';
import LoginPage from './pages/store/LoginPage';
import ProfilePage from './pages/store/ProfilePage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import NotFoundPage from './pages/store/NotFoundPage';

// El panel se descarga recién al entrar a /admin, así los clientes no cargan ese código
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminAuth = lazy(() => import('./components/AdminAuth'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/admin/ProductsPage'));
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage'));
const ShippingPage = lazy(() => import('./pages/admin/ShippingPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));

const adminFallback = <div className="min-h-screen bg-zinc-950" />;

function App() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={adminFallback}>
        <Routes>
          {/* RUTA PÚBLICA: STOREFRONT */}
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="producto/:id" element={<ProductDetailPage />} />
            <Route path="nosotros" element={<AboutPage />} />
            <Route path="seguimiento" element={<TrackingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
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
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
