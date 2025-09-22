import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
import Footer from "@/components/Footer";

const HomePage = () => {
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
