import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  Users,
  ClipboardCheck,
  UserPlus,
  MapPin,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Upload,
  Building2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "../../../contexts/useAuth";
import type { UserRole } from "../../../contexts/authContextObject";
import { useTheme } from "../../../contexts/useTheme";
import { useOrganizerRequests } from "../hooks/useOrganizerRequests";
import { useFounderRequests } from "../../../hooks/useFounderRequests";
import { useHostCapabilities } from "../../host/hooks/useHostCapabilities";
import type { HostCapabilities } from "../../host/model/hostCapabilities";
import SalsaSeguraLogo from "../../../components/brand/SalsaSeguraLogo";
import "./AdminSidebar.css";

export type AdminSidebarMode = "admin" | "host";

interface AdminSidebarProps {
  variant: "fixed" | "drawer";
  /** Which workspace the surrounding route belongs to. Drives the landmark. */
  mode?: AdminSidebarMode;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type NavItem = {
  label: string;
  icon: ComponentType<{ size?: number }>;
  to: string;
  /** Match `to` exactly instead of matching nested routes too. */
  end?: boolean;
  /**
   * Nested paths that belong to a more specific sibling entry. Keeps a
   * parent like "My Events" from lighting up on /host/events/new.
   */
  notPaths?: string[];
  section?: string;
  badge?: number | null;
};

type AdminNavItem = NavItem & { roles: UserRole[] };

type HostNavItem = NavItem & { capability: keyof HostCapabilities };

const ADMIN_NAV_SECTIONS: { title: string; roles: UserRole[]; items: AdminNavItem[] }[] = [
  {
    title: "Overview",
    roles: ["admin", "moderator"],
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        to: "/admin",
        end: true,
        roles: ["admin", "moderator"],
      },
    ],
  },
  {
    title: "Management",
    roles: ["admin"],
    items: [
      { label: "Events", icon: CalendarDays, to: "/admin/events", roles: ["admin"] },
      {
        label: "Bulk Upload",
        icon: Upload,
        to: "/admin/events/import",
        roles: ["admin"],
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
      {
        label: "Founder Requests",
        icon: ClipboardCheck,
        to: "/admin/founder-requests",
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

/**
 * Host navigation is gated by effective capabilities, never by the coarse
 * app_metadata role: a membership-only owner is a legitimate Host and must
 * receive the same links a role-carrying organizer does.
 */
const HOST_NAV_SECTIONS: { title: string; items: HostNavItem[] }[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Host Dashboard",
        icon: LayoutDashboard,
        to: "/host",
        end: true,
        capability: "hasHostAccess",
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "My Events",
        icon: CalendarDays,
        to: "/host/events",
        notPaths: ["/host/events/new", "/host/events/import"],
        capability: "hasHostAccess",
      },
      {
        label: "New Event",
        icon: CalendarPlus,
        to: "/host/events/new",
        end: true,
        capability: "canCreateEvents",
      },
      {
        label: "Import",
        icon: Upload,
        to: "/host/events/import",
        end: true,
        capability: "canImportEvents",
      },
      {
        label: "Organization",
        icon: Building2,
        to: "/host/organization",
        capability: "canManageOrganization",
      },
    ],
  },
];

/**
 * Platform roles keep the Admin surfaces; everyone else navigates by Host
 * capability. A caller with neither gets no actionable navigation — the
 * /host landing still renders its own access-request state.
 */
function navItemsFor(role: UserRole | null, capabilities: HostCapabilities): NavItem[] {
  if (role === "admin" || role === "moderator") {
    // A user with role "admin" also qualifies for moderator-scoped items.
    const grantedRoles: UserRole[] = role === "admin" ? ["admin", "moderator"] : ["moderator"];
    return ADMIN_NAV_SECTIONS.filter((section) => section.roles.includes(role)).flatMap((section) =>
      section.items
        .filter((item) => item.roles.some((granted) => grantedRoles.includes(granted)))
        .map((item) => ({ ...item, section: section.title }))
    );
  }

  if (!capabilities.hasHostAccess) return [];

  return HOST_NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => capabilities[item.capability])
      .map((item) => ({ ...item, section: section.title }))
  );
}

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.notPaths?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return false;
  }
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
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
  mode = "admin",
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { pendingCount } = useOrganizerRequests();
  const { pendingCount: founderPendingCount } = useFounderRequests();
  const hostCapabilities = useHostCapabilities();
  const { pathname } = useLocation();
  const navItems = itemsWithGroupFlags(navItemsFor(role, hostCapabilities));

  const handleSignOut = async () => {
    await signOut("global");
  };

  return (
    <nav
      aria-label={mode === "host" ? "Host navigation" : "Admin navigation"}
      className="admin-sidebar"
      data-variant={variant}
      data-mode={mode}
      data-collapsed={collapsed}
    >
      <Link className="admin-sidebar__brand" to="/" onClick={() => onNavigate?.()}>
        <SalsaSeguraLogo
          variant="full"
          size="md"
          tone={effectiveTheme === "dark" ? "white" : "brand"}
        />
      </Link>
      <div className="admin-sidebar__scroll">
        {navItems.map(({ item, showGroup }) => {
          const Icon = item.icon;
          const isOrganizerRequests = item.to === "/admin/organizer-requests";
          const isFounderRequests = item.to === "/admin/founder-requests";
          const badge = isOrganizerRequests
            ? pendingCount
            : isFounderRequests
            ? founderPendingCount
            : null;

          const isActive = isNavItemActive(item, pathname);

          return (
            <div key={item.to} className="admin-nav__item-wrap">
              {showGroup && <span className="admin-nav__group">{item.section}</span>}
              <Link
                to={item.to}
                onClick={() => onNavigate?.()}
                className={`admin-nav__link${isActive ? " admin-nav__link--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
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
              </Link>
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
