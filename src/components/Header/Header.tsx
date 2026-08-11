import { useCallback, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import type { City } from "../../contexts/CityContext";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./Header.css";

const PRIMARY_LINKS = [
  { to: "/calendar", label: "Calendar" },
  { to: "/lessons", label: "Lessons" },
  { to: "/instructors", label: "Instructors" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountDisclosure = useRef<HTMLDetailsElement>(null);
  const { city, setCity } = useCity();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const closeNavigation = useCallback(() => {
    setMobileOpen(false);
    accountDisclosure.current?.removeAttribute("open");
  }, []);

  useEscapeKey(closeNavigation);

  const selectCity = (value: City) => {
    setCity(value);
    closeNavigation();
  };

  const citySwitcher = (mobile = false) => (
    <div className={`city-switch${mobile ? " city-switch--mobile" : ""}`} role="group" aria-label="Choose city">
      {(["boston", "new-york-city"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={`city-switch__btn ${city === value ? "active" : ""}`}
          onClick={() => selectCity(value)}
          aria-pressed={city === value}
        >
          {value === "boston" ? "BOS" : "NYC"}
        </button>
      ))}
    </div>
  );

  const handleSignOut = async () => {
    await signOut();
    closeNavigation();
    navigate("/");
  };

  return (
    <header>
      <nav className="container" aria-label="Main navigation">
        <Link to="/" className="logo" onClick={closeNavigation}>
          Salsa <span>Segura</span>
        </Link>

        <ul id="site-navigation" className={`nav-links ${mobileOpen ? "active" : ""}`}>
          {PRIMARY_LINKS.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} onClick={closeNavigation}>
                {label}
              </NavLink>
            </li>
          ))}
          <li className="mobile-nav-actions">
            {citySwitcher(true)}
            {user ? (
              <>
                <NavLink to="/submit" className="auth-btn" onClick={closeNavigation}>Submit Event</NavLink>
                <NavLink to="/profile" onClick={closeNavigation}>My Profile</NavLink>
                {isAdmin && <NavLink to="/admin" onClick={closeNavigation}>Admin</NavLink>}
                <button type="button" className="drawer-sign-out" onClick={handleSignOut}>Sign Out</button>
              </>
            ) : (
              <NavLink to="/signin" className="auth-btn" onClick={closeNavigation}>Sign In</NavLink>
            )}
          </li>
        </ul>

        <div className="desktop-nav-actions">
          {citySwitcher()}
          {user ? (
            <>
              <NavLink to="/submit" className="auth-btn" onClick={closeNavigation}>Submit Event</NavLink>
              <details ref={accountDisclosure} className="account-disclosure">
                <summary>Account</summary>
                <div className="account-disclosure__menu">
                  <NavLink to="/profile" onClick={closeNavigation}>My Profile</NavLink>
                  {isAdmin && <NavLink to="/admin" onClick={closeNavigation}>Admin</NavLink>}
                  <button type="button" onClick={handleSignOut}>Sign Out</button>
                </div>
              </details>
            </>
          ) : (
            <NavLink to="/signin" className="auth-btn" onClick={closeNavigation}>Sign In</NavLink>
          )}
        </div>

        <button
          type="button"
          className={`hamburger ${mobileOpen ? "active" : ""}`}
          onClick={() => setMobileOpen((open) => !open)}
          aria-controls="site-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </header>
  );
}

export default Header;
