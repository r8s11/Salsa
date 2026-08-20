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
  Upload,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "../../contexts/useAuth";
import type { UserRole } from "../../contexts/authContextObject";
import { useTheme } from "../../contexts/useTheme";
import { useOrganizerRequests } from "../../features/admin/hooks/useOrganizerRequests";
import SalsaSeguraLogo from "../brand/SalsaSeguraLogo";
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
  to: string;
  end?: boolean;
  roles: UserRole[];
  section?: string;
  badge?: number | null;
};

type NavSection = {
  title: string;
  items: NavItem[];
  roles: UserRole[];
};

const NAV_SECTIONS: NavSection[] = [
  // ── Admin ──────────────────────────────────────────────
  {
    title: "Overview",
    roles: ["admin", "moderator", "organizer"],
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        to: "/admin",
        end: true,
        roles: ["admin", "moderator", "organizer"],
      },
    ],
  },
  {
    title: "Management",
    roles: ["admin", "moderator", "organizer"],
    items: [
      { label: "Events", icon: CalendarDays, to: "/admin/events", roles: ["admin"] },
      {
        label: "Bulk Upload",
        icon: Upload,
        to: "/admin/events/import",
        roles: ["admin", "organizer"],
      },
      { label: "Users", icon: Users, to: "/admin/users", roles: ["admin"] },
    ],
  },
  {
    title: "Review",
    roles: ["admin", "moderator"],
    items: [
      {
        label: "Event Submissions",
        icon: ClipboardCheck,
        to: "/admin/submissions",
        roles: ["admin", "moderator"],
      },
      {
        label: "Organizer Requests",
        icon: UserPlus,
        to: "/admin/organizer-requests",
        roles: ["admin", "moderator"],
      },
    ],
  },
  {
    title: "Platform",
    roles: ["admin"],
    items: [
      { label: "Venues", icon: MapPin, to: "/admin/venues", roles: ["admin"] },
      { label: "Tags", icon: Tag, to: "/admin/tags", roles: ["admin", "moderator"] },
    ],
  },
  {
    title: "System",
    roles: ["admin"],
    items: [{ label: "Settings", icon: Settings, to: "/admin/settings", roles: ["admin"] }],
  },
];

function navItemsForRole(role: UserRole | null): NavItem[] {
  const activeRoles: UserRole[] = role === null ? [] : [role];
  const roleSet = new Set(activeRoles);
  // A user with role "admin" also qualifies for moderator-scoped items.
  if (role === "admin") roleSet.add("moderator");
  return NAV_SECTIONS.filter((section) =>
    activeRoles.some((r) => section.roles.includes(r))
  ).flatMap((section) =>
    section.items
      .filter((item) => item.roles.some((r) => roleSet.has(r)))
      .map((item) => ({ ...item, section: section.title }))
  );
}

function itemsWithGroupFlags(items: NavItem[]): { item: NavItem; showGroup: boolean }[] {
  return items.reduce<{ item: NavItem; showGroup: boolean }[]>((acc, item) => {
    const previous = acc[acc.length - 1];
    const showGroup = !previous || previous.item.section !== item.section;
    return [...acc, { item, showGroup }];
  }, []);
}

export default function AdminSidebar({
  variant,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { pendingCount } = useOrganizerRequests();
  const navItems = itemsWithGroupFlags(navItemsForRole(role));

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
      <div className="admin-sidebar__brand">
        <SalsaSeguraLogo
          variant="full"
          size="md"
          tone={effectiveTheme === "dark" ? "white" : "brand"}
        />
      </div>
      <div className="admin-sidebar__scroll">
        {navItems.map(({ item, showGroup }) => {
          const Icon = item.icon;
          const isOrganizerRequests = item.to === "/admin/organizer-requests";
          const badge = isOrganizerRequests ? pendingCount : null;

          return (
            <div key={item.to} className="admin-nav__item-wrap">
              {showGroup && <span className="admin-nav__group">{item.section}</span>}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  `admin-nav__link${isActive ? " admin-nav__link--active" : ""}`
                }
                title={item.label}
              >
                <Icon size={18} />
                <span className="admin-nav__label">{item.label}</span>
                {badge !== null && badge !== undefined && badge > 0 && (
                  <span
                    className="admin-nav__badge"
                    aria-label={`${badge} pending organizer requests`}
                  >
                    {badge}
                  </span>
                )}
              </NavLink>
            </div>
          );
        })}
      </div>
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
