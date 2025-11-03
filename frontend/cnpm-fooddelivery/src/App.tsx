import { Toaster } from "sonner";
import { BrowserRouter, Route, Routes } from "react-router";
import { CartProvider } from "@/contexts/cart-context";
import { AuthProvider } from "@/contexts/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import OrderPage from "./pages/OrderPage";
import PaymentPage from "./pages/PaymentPage";
import ProfilePage from "./pages/ProfilePage";
import MyOrderPage from "./pages/MyOrderPage";
import NotFound from "./pages/NotFound";
import RestaurantDetailPage from "./pages/RestaurantDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import TestAuthPage from "./pages/TestAuthPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

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
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/test-auth" element={<TestAuthPage />} />

                            {/* Protected Routes */}
                            <Route
                                path="/orders"
                                element={
                                    <ProtectedRoute>
                                        <OrderPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/payment"
                                element={
                                    <ProtectedRoute>
                                        <PaymentPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/checkout"
                                element={
                                    <ProtectedRoute>
                                        <CheckoutPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <ProtectedRoute>
                                        <ProfilePage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/my-orders"
                                element={
                                    <ProtectedRoute>
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
