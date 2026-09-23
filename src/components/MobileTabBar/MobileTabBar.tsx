import { CalendarDays, Home, Plus, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import { resolveEventCreateDestination } from "../../lib/eventCreateDestination";
import "./MobileTabBar.css";

const CITY_SHORT: Record<string, string> = {
  boston: "BOS",
  "new-york-city": "NYC",
};

function MobileTabBar() {
  const { user, isAdmin } = useAuth();
  const { city } = useCity();

  // Discovery first. Submit mirrors the header's role-aware destination
  // (admins direct to create, everyone else through the moderated flow),
  // and the city badge carries context without spending a label box at
  // 320px. The header drawer remains the home of identity, dashboards
  // and sign-out.
  const tabs = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, end: false },
    {
      to: resolveEventCreateDestination(isAdmin ? "admin" : null),
      label: isAdmin ? "Add" : "Submit",
      icon: Plus,
      end: false,
    },
    { to: user ? "/profile" : "/signin", label: "Me", icon: User, end: false },
  ] as const;
  const cityShort = CITY_SHORT[city] ?? city.toUpperCase();
  const cityFull = city === "boston" ? "Boston" : "New York";

  return (
    <nav className="mobile-tab-bar" aria-label={`Primary, ${cityFull} events`}>
      <span className="mobile-tab-bar__city" aria-hidden="true">
        {cityShort}
      </span>
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={label} to={to} end={end} className="mobile-tab-bar__tab">
          <span className="mobile-tab-bar__icon" aria-hidden="true">
            <Icon size={21} />
          </span>
          <span className="mobile-tab-bar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileTabBar;
