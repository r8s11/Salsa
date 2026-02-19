import { useState, useEffect } from "react";
import "./Footer.css";

function Footer() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });
  const currentYear = new Date().getFullYear();

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.body.classList.toggle("dark-mode", next);
    localStorage.setItem("darkMode", String(next));
  };

  // Apply dark mode class on mount (sync with initial state)
  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-links">
          <a href="https://www.instagram.com/SalsaSegura" target="_blank" rel="noopener noreferrer">
            📱 Instagram
          </a>
          <a href="mailto:info@SalsaSegura.com">📧 Email</a>
          <a href="tel:+19784440922">📞 Call</a>
        </div>

        <div className="dark-mode-container">
          <button
            className="dark-mode-toggle"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleDarkMode}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>

        <div className="copyright">
          &copy; {currentYear} Salsa Segura. All rights reserved. | Passion For Dance
        </div>
      </div>
      <a
        href="https://www.buymeacoffee.com/rseg"
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginTop: "4px" }}
      >
        <img
          src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=rseg&button_colour=059669&font_colour=ffffff&font_family=Poppins&outline_colour=059669&coffee_colour=FFDD00"
          alt="Buy me a coffee"
          style={{ height: "36px", width: "auto", borderRadius: "8px" }}
        />
      </a>
    </footer>
  );
}

export default Footer;
