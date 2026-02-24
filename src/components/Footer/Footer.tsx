import { useState, useEffect } from "react";
import "./Footer.css";

function Footer() {
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("lightMode") === "true";
  });
  const currentYear = new Date().getFullYear();

  const toggleMode = () => {
    const next = !isLightMode;
    setIsLightMode(next);
    document.body.classList.toggle("light-mode", next);
    localStorage.setItem("lightMode", String(next));
  };

  // Apply class on mount
  useEffect(() => {
    document.body.classList.toggle("light-mode", isLightMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-links">
          <a href="https://www.instagram.com/SalsaSegura" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href="mailto:info@SalsaSegura.com">Email</a>
          <a href="tel:+19784440922">Call</a>
        </div>

        <div className="dark-mode-container">
          <button
            className="dark-mode-toggle"
            aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
            onClick={toggleMode}
          >
            {isLightMode ? "🌙" : "☀️"}
          </button>
        </div>

        <a
          href="https://www.buymeacoffee.com/rseg"
          className="bmc-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=rseg&button_colour=059669&font_colour=ffffff&font_family=Poppins&outline_colour=059669&coffee_colour=FFDD00"
            alt="Buy me a coffee"
          />
        </a>

        <div className="copyright">
          &copy; {currentYear} Salsa Segura. All rights reserved. | Passion For Dance
        </div>
      </div>
    </footer>
  );
}

export default Footer;
