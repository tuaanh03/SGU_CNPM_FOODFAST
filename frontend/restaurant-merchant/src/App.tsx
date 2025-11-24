import { Toaster } from "sonner";
import { BrowserRouter, Route, Routes, Navigate } from "react-router";
import { AuthProvider } from "@/contexts/auth-context";
import { RestaurantSocketProvider } from "@/contexts/RestaurantSocketContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import NotFound from "./pages/NotFound";
import MerchantLoginPage from "./pages/MerchantLoginPage";
import MerchantRegisterPage from "./pages/MerchantRegisterPage";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import StoreSetupPage from "./pages/StoreSetupPage";
import ProductManagementPage from "./pages/ProductManagementPage";
import ProductFormPage from "./pages/ProductFormPage";
import CategoryManagementPage from "./pages/CategoryManagementPage";
import MerchantOrderPage from "./pages/MerchantOrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";

function App() {
    return (
        <>
            <Toaster />
            <BrowserRouter>
                <AuthProvider>
                    <RestaurantSocketProvider>
                        <Routes>
                        {/* Redirect root to merchant login */}
                        <Route path="/" element={<Navigate to="/merchant/login" replace />} />

                        {/* Merchant Auth Routes */}
                        <Route path="/merchant/login" element={<MerchantLoginPage />} />
                        <Route path="/merchant/register" element={<MerchantRegisterPage />} />

                        {/* Merchant Protected Routes */}
                        <Route
                            path="/merchant/setup"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <StoreSetupPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <MerchantDashboardPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Product Management Routes */}
                        <Route
                            path="/merchant/products"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <ProductManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant/products/new"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <ProductFormPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant/products/:id/edit"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <ProductFormPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant/products/categories"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <CategoryManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant/orders"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <MerchantOrderPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/merchant/orders/:orderId"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <OrderDetailPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/orders"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <MerchantOrderPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/orders/:orderId"
                            element={
                                <ProtectedRoute requiredRole="STORE_ADMIN">
                                    <OrderDetailPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* 404 Not Found */}
                        <Route path="*" element={<NotFound />} />
                        </Routes>
                    </RestaurantSocketProvider>
                </AuthProvider>
            </BrowserRouter>
        </>
    );
}

export default App;
