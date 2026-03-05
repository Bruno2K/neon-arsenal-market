// ─── App: Root routing and provider tree ──────────────────────────────────────
// Protected routes are wrapped in <PrivateRoute> with allowedRoles.
// - /checkout, /orders, /orders/:id, /profile → any authenticated user
// - /seller/*  → SELLER role only
// - /admin/*   → ADMIN role only

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { PrivateRoute } from '@/presentation/components/auth/PrivateRoute';
import MainLayout from '@/layouts/MainLayout';
import DashboardLayout from '@/layouts/DashboardLayout';

// ── Pages ─────────────────────────────────────────────────────────────────────
import Index          from './pages/Index';
import Products       from './pages/Products';
import ProductDetail  from './pages/ProductDetail';
import CartPage       from './pages/CartPage';
import Checkout       from './pages/Checkout';
import Login          from './pages/Login';
import CustomerOrders from './pages/CustomerOrders';
import OrderDetail    from './pages/OrderDetail';
import Profile        from './pages/Profile';
import SellerApply    from './pages/SellerApply';
import SellerDashboard from './pages/SellerDashboard';
import AdminDashboard  from './pages/AdminDashboard';
import PaymentSuccess  from './pages/PaymentSuccess';
import PaymentCancel   from './pages/PaymentCancel';
import NotFound        from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* ── Public routes ───────────────────────────────────────── */}
              <Route element={<MainLayout />}>
                <Route path="/"           element={<Index />} />
                <Route path="/products"   element={<Products />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart"       element={<CartPage />} />

                {/* ── Payment return (public — PayPal redirects without auth cookie) */}
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel"  element={<PaymentCancel />} />

                {/* ── Authenticated routes (any role) ───────────────────── */}
                <Route element={<PrivateRoute />}>
                  <Route path="/checkout"      element={<Checkout />} />
                  <Route path="/orders"        element={<CustomerOrders />} />
                  <Route path="/orders/:id"    element={<OrderDetail />} />
                  <Route path="/profile"       element={<Profile />} />
                  <Route path="/seller/apply"  element={<SellerApply />} />
                </Route>
              </Route>

              {/* ── Auth ────────────────────────────────────────────────── */}
              <Route path="/login" element={<Login />} />

              {/* ── Protected dashboard routes ───────────────────────────── */}
              <Route element={<DashboardLayout />}>
                <Route element={<PrivateRoute allowedRoles={['SELLER']} />}>
                  <Route path="/seller" element={<SellerDashboard />} />
                </Route>

                <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
