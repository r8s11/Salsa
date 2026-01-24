import { Outlet } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Foorter/Footer";

function MainLayout() {
  return (
    <>
      <div className="app-layout">
        <Header />
        <main className="page-content">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}

export default MainLayout;
