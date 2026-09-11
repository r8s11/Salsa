import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Calendar, Home, Menu, Plus, Search, User, X } from "lucide-react";
import "./SiteHeader.css";

export type City = "boston" | "new-york-city";

const CITIES: { id: City; short: string; label: string }[] = [
  { id: "boston", short: "BOS", label: "Greater Boston" },
  { id: "new-york-city", short: "NYC", label: "New York City" },
];

const NAV = [
  { to: "/", label: "Tonight" },
  { to: "/calendar", label: "Calendar" },
  { to: "/directory", label: "Directory" },
  { to: "/about", label: "About" },
];

const ACCOUNT_LINKS = [
  { to: "/account", label: "My account" },
  { to: "/profile", label: "Public profile" },
  { to: "/profile/edit", label: "Profile settings" },
];

const DASHBOARD_LINKS = [
  { to: "/host", label: "Host dashboard" },
  { to: "/dj", label: "DJ dashboard" },
  { to: "/moderator", label: "Moderator" },
  { to: "/admin", label: "Admin" },
];

const TABS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/calendar", label: "Calendar", Icon: Calendar },
  { to: "/directory", label: "Directory", Icon: Search },
  { to: "/account", label: "Me", Icon: User },
];

type Props = {
  city: City;
  onCityChange: (city: City) => void;
  initials?: string;
  /** Roles the signed-in user actually holds — controls which dashboard links show. */
  roles?: string[];
};

export default function SiteHeader({ city, onCityChange, initials, roles = [] }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  const dashboards = DASHBOARD_LINKS.filter((d) =>
    roles.includes(d.label.split(" ")[0].toLowerCase())
  );

  const cityToggle = (
    <div className="site-header__cities" role="group" aria-label="Choose city">
      {CITIES.map((c) => (
        <button
          key={c.id}
          type="button"
          className="site-header__city"
          aria-pressed={city === c.id}
          title={c.label}
          onClick={() => onCityChange(c.id)}
        >
          {c.short}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <header className="site-header">
        <nav className="site-header__bar">
          <Link to="/" className="site-header__logo">
            Salsa Segura
          </Link>

          <ul className="site-header__nav">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    isActive ? "site-header__link site-header__link--active" : "site-header__link"
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {cityToggle}

          <Link to="/submit" className="site-header__cta">
            <Plus size={15} aria-hidden="true" />
            Add event
          </Link>

          <div className="site-header__account" ref={accountRef}>
            <button
              type="button"
              className="site-header__avatar"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Account menu"
              onClick={() => setAccountOpen((v) => !v)}
            >
              {initials ?? "SM"}
            </button>

            {accountOpen && (
              <div className="site-header__menu" role="menu">
                {ACCOUNT_LINKS.map((l) => (
                  <Link key={l.to} to={l.to} className="site-header__menu-item" role="menuitem">
                    {l.label}
                  </Link>
                ))}
                {dashboards.length > 0 && (
                  <>
                    <div className="site-header__menu-label">Dashboards</div>
                    {dashboards.map((l) => (
                      <Link key={l.to} to={l.to} className="site-header__menu-item" role="menuitem">
                        {l.label}
                      </Link>
                    ))}
                  </>
                )}
                <div className="site-header__menu-sep" />
                <Link to="/signout" className="site-header__menu-item" role="menuitem">
                  Sign out
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className="site-header__burger"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </nav>
      </header>

      {drawerOpen && (
        <div className="site-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="site-drawer__top">
            <span className="site-header__logo">Salsa Segura</span>
            <button
              type="button"
              className="site-drawer__close"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="site-drawer__cities">{cityToggle}</div>
          <ul className="site-drawer__nav">
            {NAV.concat(ACCOUNT_LINKS).map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="site-drawer__link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/submit" className="site-drawer__cta">
            Add an event
          </Link>
        </div>
      )}

      <nav className="site-tabbar" aria-label="Primary">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              isActive ? "site-tabbar__tab site-tabbar__tab--active" : "site-tabbar__tab"
            }
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {scrolled && (
        <div className="site-cityfloat">
          <span className="site-cityfloat__label">City</span>
          {cityToggle}
        </div>
      )}
    </>
  );
}
