import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import HomePage from './pages/store/HomePage';
import DashboardPage from './pages/admin/DashboardPage';
import ProductsPage from './pages/admin/ProductsPage';

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
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
