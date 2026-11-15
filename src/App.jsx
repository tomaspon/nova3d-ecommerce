import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { onPlatformHost, hostsAreSplit } from './platformBrand';
import { SUPERADMIN } from './sitePaths';
import { ToPlatform, AdminToPanel, OldPlatformRedirect } from './components/SiteRedirects';

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
const PlatformLayout = lazy(() => import('./layouts/PlatformLayout'));
const PlatformDashboard = lazy(() => import('./pages/platform/PlatformDashboard'));
const PlatformHome = lazy(() => import('./pages/platform/PlatformHome'));
const TermsPage = lazy(() => import('./pages/platform/TermsPage'));
const CreateStorePage = lazy(() => import('./pages/platform/CreateStorePage'));
const ManualPage = lazy(() => import('./pages/admin/ManualPage'));
const DesignPage = lazy(() => import('./pages/admin/DesignPage'));
const PanelHome = lazy(() => import('./pages/platform/PanelHome'));
const OffersPage = lazy(() => import('./pages/admin/OffersPage'));

// Dos sitios en un mismo despliegue (ver src/sitePaths.js):
//  - la plataforma: página oficial, alta, panel de cada tienda y superadmin
//  - las tiendas: lo que ve el comprador
// Con la plataforma en su propia dirección, cada sitio muestra solo lo suyo y manda al otro
// lo que no le corresponde. Sin dirección aparte (local), conviven y la página oficial está en /inicio.
const isPlatform = onPlatformHost();
const isStore = !isPlatform;
const split = hostsAreSplit();
// En una tienda, las páginas de la plataforma se abren en la dirección de la plataforma
const platformPage = (element) => (split && isStore ? <ToPlatform /> : element);

const adminFallback = <div className="min-h-screen bg-zinc-950" />;

function App() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={adminFallback}>
        <Routes>
          {isPlatform ? (
            <>
              <Route path="/" element={<PlatformHome />} />
              <Route path="/inicio" element={<Navigate to="/" replace />} />
              {/* Lo que no es de la plataforma vuelve a la página oficial */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              {/* TIENDA: lo que ve el comprador */}
              <Route path="/" element={<StoreLayout />}>
                <Route index element={<HomePage />} />
                <Route path="producto/:id" element={<ProductDetailPage />} />
                <Route path="nosotros" element={<AboutPage />} />
                <Route path="seguimiento" element={<TrackingPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              {/* tienda.com/admin lleva al panel de esa tienda */}
              <Route path="/admin/*" element={<AdminToPanel />} />
              <Route path="/inicio" element={platformPage(<PlatformHome />)} />
            </>
          )}

          {/* PLATAFORMA: alta y acceso */}
          <Route path="/crear" element={platformPage(<CreateStorePage />)} />
          <Route path="/terminos" element={platformPage(<TermsPage />)} />
          <Route path="/ingresar" element={platformPage(<Navigate to="/panel" replace />)} />

          {/* PLATAFORMA: panel de cada tienda (la tienda va en la dirección) */}
          <Route path="/panel" element={platformPage(<AdminAuth mode="account"><PanelHome /></AdminAuth>)} />
          <Route path="/panel/:slug" element={platformPage(<AdminAuth mode="store"><AdminLayout /></AdminAuth>)}>
            <Route index element={<DashboardPage />} />
            <Route path="productos" element={<ProductsPage />} />
            <Route path="ordenes" element={<OrdersPage />} />
            <Route path="envios" element={<ShippingPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="ofertas" element={<OffersPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="diseno" element={<DesignPage />} />
            <Route path="ayuda" element={<ManualPage />} />
          </Route>

          {/* PLATAFORMA: superadmin, con verificación en dos pasos */}
          <Route path={SUPERADMIN} element={platformPage(<AdminAuth mode="platform"><PlatformLayout /></AdminAuth>)}>
            <Route index element={<PlatformDashboard />} />
            <Route path="tiendas" element={<PlatformPage view="stores" />} />
            <Route path="solicitudes" element={<PlatformPage view="requests" />} />
            <Route path="usuarios" element={<UsersPage />} />
          </Route>

          {/* Direcciones viejas */}
          <Route path="/plataforma/*" element={platformPage(<OldPlatformRedirect />)} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
