import { Outlet } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import MobileTabBar from "../components/MobileTabBar/MobileTabBar";
import FloatingCityPill from "../components/FloatingCityPill/FloatingCityPill";

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
      <FloatingCityPill />
      <MobileTabBar />
    </>
  );
}

export default MainLayout;
