import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function ScrollToTop() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    // Returning to a route we were on (back/forward) restores the scroll
    // position saved when we left it. Every other navigation starts at top.
    if (navType === "POP") {
      const saved = sessionStorage.getItem(`shop-scroll:${key}`);
      if (saved !== null) {
        window.scrollTo(0, Number(saved));
        sessionStorage.removeItem(`shop-scroll:${key}`);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, key, navType]);
  return null;
}

export default ScrollToTop;
