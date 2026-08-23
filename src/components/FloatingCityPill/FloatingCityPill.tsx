import { useEffect, useState } from "react";
import { useCity } from "../../contexts/useCity";
import type { City } from "../../types/events";
import "./FloatingCityPill.css";

const SCROLL_THRESHOLD = 420;

function FloatingCityPill() {
  const { city, setCity } = useCity();
  const [visible, setVisible] = useState(() => window.scrollY > SCROLL_THRESHOLD);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  const cities: { value: City; label: string }[] = [
    { value: "boston", label: "BOS" },
    { value: "new-york-city", label: "NYC" },
  ];

  return (
    <div className="floating-city-pill" role="group" aria-label="Choose city">
      <span className="floating-city-pill__label">City</span>
      {cities.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`floating-city-pill__btn ${city === value ? "active" : ""}`}
          aria-pressed={city === value}
          onClick={() => setCity(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default FloatingCityPill;
