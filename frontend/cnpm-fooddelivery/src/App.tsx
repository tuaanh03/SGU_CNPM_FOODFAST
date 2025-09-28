import {Toaster} from "sonner";
import {BrowserRouter, Route, Routes} from "react-router";
import {CartProvider} from "@/contexts/cart-context";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import OrderPage from "./pages/OrderPage";
import PaymentPage from "./pages/PaymentPage";
import ProfilePage from "./pages/ProfilePage";
import MyOrderPage from "./pages/MyOrderPage";
import NotFound from "./pages/NotFound.tsx";
import RestaurantDetailPage from "./pages/RestaurantDetailPage";

function App() {


    return (
        <>
            <Toaster/>
            <CartProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<HomePage/>}/>
                        <Route path="/products" element={<ProductPage/>}/>
                        <Route path="/order" element={<OrderPage/>}/>
                        <Route path="/payment" element={<PaymentPage/>}/>
                        <Route path="/profile" element={<ProfilePage/>}/>
                        <Route path="/my-orders" element={<MyOrderPage/>}/>
                        <Route path="/restaurant/:id" element={<RestaurantDetailPage/>}/>
                        <Route path="*" element={<NotFound/>}/>
                    </Routes>
                </BrowserRouter>
            </CartProvider>
        </>
    )
}

export default App