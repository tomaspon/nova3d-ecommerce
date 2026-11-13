import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { isPlatformHost } from './platformBrand';

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
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const PlatformPage = lazy(() => import('./pages/platform/PlatformPage'));
const PlatformHome = lazy(() => import('./pages/platform/PlatformHome'));
const ManualPage = lazy(() => import('./pages/admin/ManualPage'));

// En el dominio de la plataforma la dirección principal es la página oficial;
// en cualquier otro (tiendas, Vercel, localhost) es una tienda.
const onPlatformHost = isPlatformHost(window.location.hostname);

const adminFallback = <div className="min-h-screen bg-zinc-950" />;

function App() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={adminFallback}>
        <Routes>
          {/* RUTA PÚBLICA: STOREFRONT (o la página oficial, en el dominio de la plataforma) */}
          {onPlatformHost ? (
            <Route path="/" element={<PlatformHome />} />
          ) : (
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="producto/:id" element={<ProductDetailPage />} />
            <Route path="nosotros" element={<AboutPage />} />
            <Route path="seguimiento" element={<TrackingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          )}

          {/* Página oficial de la plataforma: vista previa en cualquier dominio */}
          <Route path="/plataforma/inicio" element={<PlatformHome />} />

          {/* RUTA PRIVADA: PANEL DE PLATAFORMA (todas las tiendas) */}
          <Route path="/plataforma" element={<AdminAuth platformOnly><PlatformPage /></AdminAuth>} />

          {/* RUTA PRIVADA: CMS DASHBOARD */}
          <Route path="/admin" element={<AdminAuth><AdminLayout /></AdminAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="ayuda" element={<ManualPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
