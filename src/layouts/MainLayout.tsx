import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import MobileTabBar from "../components/layout/MobileTabBar";
import FloatingCityPill from "../components/layout/FloatingCityPill";
import SkipLink from "../shared/a11y/SkipLink";
import CartProvider from "../features/shopify/cart/CartProvider";
import CartDrawer from "../features/shopify/cart/CartDrawer";

/**
 * First focusable element on every public page. The home page's job is the
 * event feed, so there it jumps past the header and hero straight to it;
 * elsewhere it jumps to the page's main content.
 */
function PublicSkipLink() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const targetId = onHome ? "events" : "main-content";

  return (
    <SkipLink targetId={targetId}>
      {onHome ? "Skip to events" : "Skip to content"}
    </SkipLink>
  );
}

function MainLayout() {
  return (
    <CartProvider>
      <PublicSkipLink />
      <div className="app-layout">
        <Header />
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
        <Footer />
      </div>
      <FloatingCityPill />
      <MobileTabBar />
      <CartDrawer />
    </CartProvider>
  );
}

export default MainLayout;
