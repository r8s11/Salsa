import { useEffect, useState } from "react";
import MetroExplorer from "../../features/metros/components/MetroExplorer";
import "./FloatingCityPill.css";

const SCROLL_THRESHOLD = 420;

function FloatingCityPill() {
  const [visible, setVisible] = useState(() => window.scrollY > SCROLL_THRESHOLD);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const footer = document.querySelector(".app-layout > footer");
    if (!footer || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting)
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  if (!visible || footerVisible) return null;

  // Anchored bottom-right: the panel opens upward and hugs the trigger's
  // right edge so it never overruns the viewport.
  return (
    <div className="floating-city-pill">
      <MetroExplorer variant="pill" className="metro-explorer--above metro-explorer--end" />
    </div>
  );
}

export default FloatingCityPill;