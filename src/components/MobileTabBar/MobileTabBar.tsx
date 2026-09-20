import { CalendarDays, Home, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import "./MobileTabBar.css";

function MobileTabBar() {
  const { user } = useAuth();

  // Primary destinations only. Event creation lives in the header menu, which
  // is the single place on mobile that carries role-dependent actions.
  const tabs = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, end: false },
    { to: user ? "/profile" : "/signin", label: "Me", icon: User, end: false },
  ] as const;

  return (
    <nav className="mobile-tab-bar" aria-label="Primary">
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
