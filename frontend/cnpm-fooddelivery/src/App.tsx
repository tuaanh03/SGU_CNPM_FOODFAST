import {Toaster, toast} from "sonner";
import {BrowserRouter, Route, Routes} from "react-router";
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound.tsx";

function App() {


  return (
    <>
        <Toaster/>


        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage/>}/>
                <Route path="*" element={<NotFound/>}/>
            </Routes>
        </BrowserRouter>
    </>
  )
}

export default App
