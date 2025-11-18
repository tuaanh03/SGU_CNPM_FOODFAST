import { Toaster } from "sonner";
import { BrowserRouter, Route, Routes } from "react-router";
import { CartProvider } from "@/contexts/cart-context";
import { AuthProvider } from "@/contexts/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import OrderPage from "./pages/OrderPage";
import PaymentPage from "./pages/PaymentPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import ProfilePage from "./pages/ProfilePage";
import MyOrderPage from "./pages/MyOrderPage";
import NotFound from "./pages/NotFound";
import RestaurantDetailPage from "./pages/RestaurantDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import TestAuthPage from "./pages/TestAuthPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminRegisterPage from "./pages/AdminRegisterPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

function App() {
    return (
        <>
            <Toaster />
            <AuthProvider>
                <CartProvider>
                    <BrowserRouter>
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/" element={<HomePage />} />
                            <Route path="/products" element={<ProductPage />} />
                            <Route path="/restaurant/:id" element={<RestaurantDetailPage />} />

                            {/* Payment Result - Public (VNPay redirect) */}
                            <Route path="/payment-result" element={<PaymentResultPage />} />

                            {/* Customer Auth Routes */}
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />

                            {/* Admin Auth Routes */}
                            <Route path="/admin/login" element={<AdminLoginPage />} />
                            <Route path="/admin/register" element={<AdminRegisterPage />} />

                            {/* Admin Protected Routes */}
                            <Route
                                path="/admin"
                                element={
                                    <ProtectedRoute requiredRole="STORE_ADMIN">
                                        <AdminDashboardPage />
                                    </ProtectedRoute>
                                }
                            />

                            <Route path="/test-auth" element={<TestAuthPage />} />

                            {/* Protected Routes - Customer Only */}
                            <Route
                                path="/orders"
                                element={
                                    <ProtectedRoute requiredRole="CUSTOMER">
                                        <OrderPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/payment"
                                element={
                                    <ProtectedRoute requiredRole="CUSTOMER">
                                        <PaymentPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/checkout"
                                element={
                                    <ProtectedRoute requiredRole="CUSTOMER">
                                        <CheckoutPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <ProtectedRoute requiredRole="CUSTOMER">
                                        <ProfilePage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/my-orders"
                                element={
                                    <ProtectedRoute requiredRole="CUSTOMER">
                                        <MyOrderPage />
                                    </ProtectedRoute>
                                }
                            />

                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </BrowserRouter>
                </CartProvider>
            </AuthProvider>
        </>
    );
}

export default App;
