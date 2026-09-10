import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import MainLayout from "@/layouts/MainLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageViewTracker } from "@/components/PageViewTracker";
import { createAppQueryClient } from "@/lib/queryClient";

const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const CartPage = lazy(() => import("./pages/CartPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderStatusPage = lazy(() => import("./pages/OrderStatus"));
const AccountPage = lazy(() => import("./pages/Account"));
const AccountOrdersPage = lazy(() => import("./pages/AccountOrders"));
const AccountOrderDetailRedirect = lazy(() =>
  import("./pages/AccountOrders").then((module) => ({
    default: module.AccountOrderDetailRedirect,
  })),
);
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SellerProducts = lazy(() => import("./pages/seller/SellerProducts"));
const SellerListings = lazy(() => import("./pages/seller/SellerListings"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerTransactions = lazy(
  () => import("./pages/seller/SellerTransactions"),
);
const AdminSellers = lazy(() => import("./pages/admin/AdminSellers"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const StorePage = lazy(() => import("./pages/StorePage"));
const AccountFavoritesPage = lazy(() => import("./pages/AccountFavorites"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = createAppQueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <PageViewTracker />
              <Suspense fallback={null}>
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/stores/:sellerId" element={<StorePage />} />
                    <Route path="/listing/:id" element={<ListingDetail />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route
                      path="/orders/:id/return"
                      element={
                        <ProtectedRoute>
                          <OrderStatusPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders/:id/cancel"
                      element={
                        <ProtectedRoute>
                          <OrderStatusPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders/:id"
                      element={
                        <ProtectedRoute>
                          <OrderStatusPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/account"
                      element={
                        <ProtectedRoute>
                          <AccountPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/account/favorites"
                      element={
                        <ProtectedRoute>
                          <AccountFavoritesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/account/orders"
                      element={
                        <ProtectedRoute>
                          <AccountOrdersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/account/orders/:id"
                      element={
                        <ProtectedRoute>
                          <AccountOrderDetailRedirect />
                        </ProtectedRoute>
                      }
                    />
                  </Route>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    element={
                      <ProtectedRoute>
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route
                      path="/seller"
                      element={
                        <ProtectedRoute allowedRoles={["SELLER"]}>
                          <SellerDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/seller/products"
                      element={
                        <ProtectedRoute allowedRoles={["SELLER"]}>
                          <SellerProducts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/seller/listings"
                      element={
                        <ProtectedRoute allowedRoles={["SELLER"]}>
                          <SellerListings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/seller/orders"
                      element={
                        <ProtectedRoute allowedRoles={["SELLER"]}>
                          <SellerOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/seller/transactions"
                      element={
                        <ProtectedRoute allowedRoles={["SELLER"]}>
                          <SellerTransactions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/catalog"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminCatalog />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/products"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminProducts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/sellers"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminSellers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/orders"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/orders/:id"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminOrderDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <ProtectedRoute allowedRoles={["ADMIN"]}>
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
