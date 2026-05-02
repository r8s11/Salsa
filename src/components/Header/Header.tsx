import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCity, type City } from "../../contexts/CityContext";
import "./Header.css";

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { city, setCity } = useCity();

  const closeMenu = () => {
    setMobileOpen(false);
  };

  const cityButton = (value: City, label: string) => (
    <button
      type="button"
      className={`city-switch__btn ${city === value ? "active" : ""}`}
      onClick={() => setCity(value)}
      aria-pressed={city === value}
    >
      {label}
    </button>
  );

  return (
    <header>
      <nav className="container">
        <Link to="/" className="logo" onClick={closeMenu}>
          Salsa <span>Segura</span>
        </Link>
        <div className="city-switch" role="group" aria-label="Choose city">
          {cityButton("boston", "BOS")}
          {cityButton("new-york-city", "NYC")}
        </div>
        <ul className={`nav-links ${mobileOpen ? "active" : ""}`}>
          <li>
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to={"/about"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              About
            </NavLink>
          </li>
          <li>
            <NavLink
              to={"/calendar"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Calendar
            </NavLink>
          </li>
          <li>
            <NavLink to={"/#events"} onClick={closeMenu} className={() => ""}>
              Events
            </NavLink>
          </li>
          <li>
            <NavLink
              to={"/lessons"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Lessons
            </NavLink>
          </li>
          <li>
            <NavLink
              to={"/instructors"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Instructors
            </NavLink>
          </li>
          <li>
            <NavLink
              to={"/contact"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Contact
            </NavLink>
          </li>
        </ul>
        <button
          className={`hamburger ${mobileOpen ? "active" : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
