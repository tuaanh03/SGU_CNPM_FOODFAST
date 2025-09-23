import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
import Footer from "@/components/Footer";
import {useState, useEffect} from "react";
import {toast} from "sonner";
import axios from "axios";

const HomePage = () => {

    const [products, setProducts] = useState([]);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
      try {
        const response = await axios.get("http://localhost:3000/api/products");
        setProducts(response.data);
        console.log(response.data);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Something went wrong!");
      }
    }

    return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Navigation />
      <Banner />
      <ProductList />
      <Footer />
    </div>
  );
}

export default HomePage;
