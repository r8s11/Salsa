import type { MouseEvent } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import MobileTabBar from "../components/MobileTabBar/MobileTabBar";
import FloatingCityPill from "../components/FloatingCityPill/FloatingCityPill";

/**
 * First focusable element on every public page. The home page's job is the
 * event feed, so there it jumps past the header and hero straight to it;
 * elsewhere it jumps to the page's main content.
 */
function SkipLink() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const targetId = onHome ? "events" : "main-content";

  // Move focus, not just scroll: the next Tab must continue from the target.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
  };

  return (
    <a className="skip-link" href={`#${targetId}`} onClick={handleClick}>
      {onHome ? "Skip to events" : "Skip to content"}
    </a>
  );
}

function MainLayout() {
  return (
    <>
      <SkipLink />
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
