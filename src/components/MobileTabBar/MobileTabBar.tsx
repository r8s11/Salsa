import { CalendarDays, Home, PlusCircle, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import "./MobileTabBar.css";

function MobileTabBar() {
  const { user } = useAuth();

  const tabs = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, end: false },
    { to: "/submit", label: "Submit", icon: PlusCircle, end: false },
    { to: user ? "/profile" : "/signin", label: "Me", icon: User, end: false },
  ] as const;

  return (
    <nav className="mobile-tab-bar" aria-label="Primary">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={label} to={to} end={end} className="mobile-tab-bar__tab">
          <Icon size={20} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileTabBar;
