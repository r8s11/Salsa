import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import MobileTabBar from "../components/MobileTabBar/MobileTabBar";
import FloatingCityPill from "../components/FloatingCityPill/FloatingCityPill";
import SkipLink from "../shared/a11y/SkipLink";

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
    <>
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
    </>
  );
}

export default MainLayout;
