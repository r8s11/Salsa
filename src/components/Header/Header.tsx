import { useCallback, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import type { City } from "../../contexts/CityContext";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import SalsaSeguraLogo from "../brand/SalsaSeguraLogo";
import AccountAvatar from "./AccountAvatar";
import ButtonLink from "../ui/ButtonLink";
import "./Header.css";

const PRIMARY_LINKS = [
  { to: "/calendar", label: "Calendar" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

const CITY_CARDS = [
  { value: "boston", short: "BOS", name: "Boston", region: "Greater BOS" },
  { value: "new-york-city", short: "NYC", name: "New York", region: "NYC" },
] as const;

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountDisclosure = useRef<HTMLDetailsElement>(null);
  const { city, setCity } = useCity();
  const { user, isModerator, isAdmin, isOrganizer, signOut } = useAuth();
  const { profile } = useOwnProfile(user?.id);
  const navigate = useNavigate();

  const dashboardLinks: ReadonlyArray<{ to: string; label: string }> = [
    ...(isOrganizer ? [{ to: "/host", label: "Host Dashboard" }] : []),
    ...(isAdmin || isModerator ? [{ to: "/admin", label: "Dashboard" }] : []),
  ];

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
    <div
      className={`city-switch${mobile ? " city-switch--mobile" : ""}`}
      role="group"
      aria-label="Choose city"
    >
      {CITY_CARDS.map(({ value, short, name, region }) => (
        <button
          key={value}
          type="button"
          className={`city-switch__btn ${city === value ? "active" : ""}`}
          onClick={() => selectCity(value)}
          aria-pressed={city === value}
        >
          {mobile ? (
            <>
              <span className="city-switch__name">{name}</span>
              <span className="city-switch__region">{region}</span>
            </>
          ) : (
            short
          )}
        </button>
      ))}
    </div>
  );

  const handleSignOut = async () => {
    await signOut("global");
    closeNavigation();
    navigate("/");
  };

  return (
    <header className="site-header">
      <nav className="container" aria-label="Main navigation">
        <Link to="/" className="logo" onClick={closeNavigation}>
          <SalsaSeguraLogo variant="full" size="lg" tone="brand" />
        </Link>

        <ul id="site-navigation" className={`nav-links ${mobileOpen ? "active" : ""}`}>
          {PRIMARY_LINKS.map(({ to, label }, index) => (
            <li key={to}>
              <NavLink to={to} onClick={closeNavigation}>
                <span className="nav-links__num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="nav-links__label">{label}</span>
                <span className="nav-links__marker" aria-hidden="true">
                  ◆
                </span>
              </NavLink>
            </li>
          ))}
          <li className="mobile-nav-actions">
            <span className="mobile-nav__context">Explore Salsa Segura</span>
            <section className="mobile-nav__city" aria-labelledby="mobile-nav-city-label">
              <span id="mobile-nav-city-label" className="mobile-nav__label">
                Your city
              </span>
              {citySwitcher(true)}
            </section>
            <section className="mobile-nav__account" aria-labelledby="mobile-nav-account-label">
              <span id="mobile-nav-account-label" className="mobile-nav__label">
                Account
              </span>
              {user ? (
                <>
                  <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
                    Submit Event
                  </ButtonLink>
                  {dashboardLinks.length > 0 && (
                    <div className="mobile-nav__dashboards">
                      <span className="mobile-nav__dashboards-label">Dashboards</span>
                      {dashboardLinks.map(({ to, label }) => (
                        <NavLink key={to} to={to} onClick={closeNavigation}>
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                  <NavLink to="/account" className="mobile-nav__identity" onClick={closeNavigation}>
                    <AccountAvatar
                      avatarUrl={profile?.avatar_url}
                      displayName={profile?.display_name}
                      username={profile?.username}
                      email={user.email}
                    />
                    <span className="mobile-nav__identity-text">
                      <span className="mobile-nav__identity-name">
                        {profile?.display_name ?? profile?.username ?? "My Account"}
                      </span>
                      {user.email && (
                        <span className="mobile-nav__identity-email">{user.email}</span>
                      )}
                    </span>
                    <span className="mobile-nav__identity-cta" aria-hidden="true">
                      Account
                    </span>
                  </NavLink>
                  <NavLink to="/profile" onClick={closeNavigation}>
                    My Profile
                  </NavLink>
                  <button type="button" className="drawer-sign-out" onClick={handleSignOut}>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
                    Submit Event
                  </ButtonLink>
                  <ButtonLink to="/signin" size="compact" onClick={closeNavigation}>
                    Sign In
                  </ButtonLink>
                </>
              )}
            </section>
          </li>
        </ul>

        <div className="desktop-nav-actions">
          {citySwitcher()}
          {user ? (
            <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
              Submit Event
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
                Submit Event
              </ButtonLink>
              <ButtonLink to="/signin" size="compact" onClick={closeNavigation}>
                Sign In
              </ButtonLink>
            </>
          )}
        </div>

        {user && (
          <details ref={accountDisclosure} className="account-disclosure">
            <summary aria-label="Open account menu">
              <AccountAvatar
                avatarUrl={profile?.avatar_url}
                displayName={profile?.display_name}
                username={profile?.username}
                email={user.email}
              />
            </summary>
            <div className="account-disclosure__menu">
              {dashboardLinks.length > 0 && (
                <div className="account-disclosure__dashboards">
                  <span className="account-disclosure__dashboards-label">Dashboards</span>
                  {dashboardLinks.map(({ to, label }) => (
                    <NavLink key={to} to={to} onClick={closeNavigation}>
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
              <NavLink to="/account" onClick={closeNavigation}>
                My Account
              </NavLink>
              <NavLink to="/profile" onClick={closeNavigation}>
                My Profile
              </NavLink>
              <button type="button" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </details>
        )}
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
