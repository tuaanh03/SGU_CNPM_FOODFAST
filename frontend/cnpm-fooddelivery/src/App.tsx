import { Toaster } from "sonner";
import { BrowserRouter, Route, Routes } from "react-router";
import { CartProvider } from "@/contexts/cart-context";
import { AuthProvider } from "@/contexts/auth-context";

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

function App() {
    return (
        <>
            <Toaster />
            <AuthProvider>
                <CartProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/products" element={<ProductPage />} />
                            <Route path="/orders" element={<OrderPage />} />
                            <Route path="/payment" element={<PaymentPage />} />
                            <Route path="/checkout" element={<CheckoutPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/my-orders" element={<MyOrderPage />} />
                            <Route path="/test-auth" element={<TestAuthPage />} />
                            <Route path="/restaurant/:id" element={<RestaurantDetailPage />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </BrowserRouter>
                </CartProvider>
            </AuthProvider>
        </>
    );
}

export default App;
