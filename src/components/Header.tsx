import { useState } from "react";

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => {
    setMobileOpen(false);
  };

  return (
    <header>
      <nav className="container">
        <div className="logo">🕺🏽Salsa Segura</div>
        <ul className={`nav-links ${mobileOpen ? "active" : ""}`}>
          <li>
            <a href="#home" onClick={closeMenu}>
              Home
            </a>
          </li>
          <li>
            <a href="#events" onClick={closeMenu}>
              Events
            </a>
          </li>
          <li>
            <a href="#lessons" onClick={closeMenu}>
              Lessons
            </a>
          </li>
          <li>
            <a href="#instructor" onClick={closeMenu}>
              Instructor
            </a>
          </li>
          <li>
            <a href="#contact" onClick={closeMenu}>
              Contact
            </a>
          </li>
        </ul>
        <button
          className="hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
    </header>
  );
}

export default Header;
