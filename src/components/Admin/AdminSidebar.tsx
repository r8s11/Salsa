import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardCheck,
  UserPlus,
  MapPin,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "../../contexts/useAuth";
import { useTheme } from "../../contexts/useTheme";
import "./AdminSidebar.css";

interface AdminSidebarProps {
  variant: "fixed" | "drawer";
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type NavItem = {
  label: string;
  icon: ComponentType<{ size?: number }>;
  group: string;
} & ({ to: string; built: true } | { to?: undefined; built: false });

const NAV_ITEMS: NavItem[] = [
  { group: "Overview", label: "Dashboard", icon: LayoutDashboard, to: "/admin", built: true },
  { group: "Management", label: "Events", icon: CalendarDays, to: "/admin/events", built: true },
  { group: "Management", label: "Users", icon: Users, to: "/admin/users", built: true },
  { group: "Review", label: "Event Submissions", icon: ClipboardCheck, to: "/admin/submissions", built: true },
  { group: "Review", label: "Organizer Requests", icon: UserPlus, built: false },
  { group: "Platform", label: "Venues", icon: MapPin, built: false },
  { group: "Platform", label: "Tags", icon: Tag, built: false },
  { group: "System", label: "Settings", icon: Settings, built: false },
];
const NAV_ITEMS_WITH_GROUP_FLAG = NAV_ITEMS.reduce<{ item: NavItem; showGroup: boolean }[]>(
  (acc, item) => {
    const previous = acc[acc.length - 1];
    const showGroup = !previous || previous.item.group !== item.group;
    return [...acc, { item, showGroup }];
  },
  []
);

export default function AdminSidebar({
  variant,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav
      aria-label="Admin"
      className="admin-sidebar"
      data-variant={variant}
      data-collapsed={collapsed}
    >
      <div className="admin-sidebar__brand">SalsaSegura</div>
      <div className="admin-sidebar__scroll">
        {NAV_ITEMS_WITH_GROUP_FLAG.map(({ item, showGroup }) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="admin-nav__item-wrap">
              {showGroup && <span className="admin-nav__group">{item.group}</span>}
              {item.built ? (
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={() => onNavigate?.()}
                  className={({ isActive }) =>
                    `admin-nav__link${isActive ? " admin-nav__link--active" : ""}`
                  }
                  title={item.label}
                >
                  <Icon size={18} />
                  <span className="admin-nav__label">{item.label}</span>
                </NavLink>
              ) : (
                <span
                  className="admin-nav__link admin-nav__link--disabled"
                  aria-disabled="true"
                  title={item.label}
                >
                  <Icon size={18} />
                  <span className="admin-nav__label">{item.label}</span>
                  <span className="admin-nav__soon">Soon</span>
                </span>
              )}
            </div>
          );
        })}
        {variant === "drawer" && (
          <div className="admin-sidebar__account">
            {user?.email && <p className="admin-sidebar__account-email">{user.email}</p>}
            <details className="admin-sidebar__appearance">
              <summary>Appearance</summary>
              <fieldset className="admin-account__theme-options">
                <legend className="admin-visually-hidden">Choose theme appearance</legend>
                {(["system", "light", "dark"] as const).map((option) => (
                  <label key={option} className="admin-account__theme-option">
                    <input
                      type="radio"
                      name="admin-sidebar-theme"
                      value={option}
                      checked={theme === option}
                      onChange={() => setTheme(option)}
                      aria-label={
                        option === "system" ? "System" : option === "light" ? "Light" : "Dark"
                      }
                    />
                    {option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
                  </label>
                ))}
              </fieldset>
            </details>
            <a href="/">View site</a>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
      {variant === "fixed" && onToggleCollapse && (
        <button
          type="button"
          className="admin-sidebar__collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeft size={16} />}
          <span className="admin-nav__label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      )}
    </nav>
  );
}
