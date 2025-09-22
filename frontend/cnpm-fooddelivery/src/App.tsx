import {Toaster} from "sonner";
import {BrowserRouter, Route, Routes} from "react-router";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import OrderPage from "./pages/OrderPage";
import PaymentPage from "./pages/PaymentPage";
import NotFound from "./pages/NotFound.tsx";

function App() {


    return (
        <>
            <Toaster/>


            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<HomePage/>}/>
                    <Route path="/products" element={<ProductPage/>}/>
                    <Route path="/order" element={<OrderPage/>}/>
                    <Route path="/payment" element={<PaymentPage/>}/>
                    <Route path="*" element={<NotFound/>}/>
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App