import { Outlet } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import MobileTabBar from "../components/MobileTabBar/MobileTabBar";

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
      <MobileTabBar />
    </>
  );
}

export default MainLayout;
