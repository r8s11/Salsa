import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  Users,
  ClipboardCheck,
  KeyRound,
  UserPlus,
  MapPin,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Upload,
  Building2,
} from "lucide-react";
import { useId, useState, type ComponentType } from "react";
import { useAuth } from "../../contexts/useAuth";
import type { UserRole } from "../../contexts/authContextObject";
import { useTheme } from "../../contexts/useTheme";
import {
  usePendingFounderRequestCount,
  usePendingOrganizerRequestCount,
} from "../../features/admin/hooks/usePendingRequestCounts";
import { useHostCapabilities } from "../../features/host/hooks/useHostCapabilities";
import AdminThemeOptions from "./AdminThemeOptions";
import type { HostCapabilities } from "../../features/host/model/hostCapabilities";
import SalsaSeguraLogo from "../brand/SalsaSeguraLogo";
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
};

type AdminNavItem = NavItem & { roles: UserRole[] };

type HostNavItem = NavItem & { capability: keyof HostCapabilities };

const ORGANIZER_REQUESTS_PATH = "/admin/organizer-requests";
const FOUNDER_REQUESTS_PATH = "/admin/founder-requests";

const ADMIN_NAV_SECTIONS: { title: string; roles: UserRole[]; items: AdminNavItem[] }[] = [
  {
    title: "Desk",
    roles: ["admin", "moderator"],
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        to: "/admin",
        end: true,
        roles: ["admin", "moderator"],
      },
      {
        label: "Event Submissions",
        icon: ClipboardCheck,
        to: "/admin/submissions",
        roles: ["admin", "moderator"],
      },
      {
        label: "Organizer Requests",
        icon: UserPlus,
        to: ORGANIZER_REQUESTS_PATH,
        roles: ["admin", "moderator"],
      },
      {
        label: "Founder Requests",
        icon: KeyRound,
        to: FOUNDER_REQUESTS_PATH,
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
    title: "Platform",
    roles: ["admin"],
    items: [
      { label: "Venues", icon: MapPin, to: "/admin/venues", roles: ["admin"] },
      { label: "Series", icon: CalendarDays, to: "/admin/series", roles: ["admin"] },
      { label: "Organizers", icon: Building2, to: "/admin/organizers", roles: ["admin"] },
      { label: "Schools", icon: Building2, to: "/admin/schools", roles: ["admin"] },
      { label: "Instructors", icon: Users, to: "/admin/instructors", roles: ["admin"] },
      { label: "Tags", icon: Tag, to: "/admin/tags", roles: ["admin"] },
      { label: "Settings", icon: Settings, to: "/admin/settings", roles: ["admin"] },
    ],
  },
];

/**
 * Host navigation is gated by effective capabilities, never by the coarse
 * app_metadata role: a membership-only owner is a legitimate Host and must
 * receive the same links a role-carrying organizer does.
 */
const HOST_NAV_SECTIONS: { title: string; items: HostNavItem[] }[] = [
  {
    title: "Host",
    items: [
      {
        label: "Host Dashboard",
        icon: LayoutDashboard,
        to: "/host",
        end: true,
        capability: "hasHostAccess",
      },
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
  // A lone group's label would name everything, so it names nothing: only
  // label groups when there is more than one to tell apart.
  const labelled = new Set(items.map((item) => item.section)).size > 1;
  return items.map((item, index) => ({
    item,
    showGroup: labelled && (index === 0 || items[index - 1].section !== item.section),
  }));
}

export default function AdminSidebar({
  variant,
  mode = "admin",
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { user, role, signOut } = useAuth();
  const { effectiveTheme } = useTheme();
  const hostCapabilities = useHostCapabilities();
  const { pathname } = useLocation();
  const items = navItemsFor(role, hostCapabilities);
  const activeItem = items.reduce<NavItem | undefined>(
    (active, item) =>
      isNavItemActive(item, pathname) && (!active || item.to.length > active.to.length)
        ? item
        : active,
    undefined
  );
  const navItems = itemsWithGroupFlags(items);

  const navId = useId();
  const [signOutState, setSignOutState] = useState<"idle" | "pending" | "error">("idle");
  // Counts are fetched only when the viewer's nav actually lists the queue,
  // so Host users never trigger an admin RPC. Count only: no directory load.
  const showsOrganizerQueue = items.some((item) => item.to === ORGANIZER_REQUESTS_PATH);
  const showsFounderQueue = items.some((item) => item.to === FOUNDER_REQUESTS_PATH);
  const pendingByPath: Record<string, number> = {
    [ORGANIZER_REQUESTS_PATH]: usePendingOrganizerRequestCount(showsOrganizerQueue),
    [FOUNDER_REQUESTS_PATH]: usePendingFounderRequestCount(showsFounderQueue),
  };

  const handleSignOut = async () => {
    if (signOutState === "pending") return;
    setSignOutState("pending");
    try {
      const { error } = await signOut("local");
      setSignOutState(error ? "error" : "idle");
    } catch {
      setSignOutState("error");
    }
  };

  return (
    <nav
      aria-label={mode === "host" ? "Host navigation" : "Admin navigation"}
      id={navId}
      className="admin-sidebar"
      data-variant={variant}
      data-mode={mode}
      data-collapsed={collapsed}
    >
      <Link
        className="admin-sidebar__brand"
        to="/"
        aria-label="Salsa Segura home"
        onClick={() => onNavigate?.()}
      >
        <SalsaSeguraLogo
          variant="full"
          size="md"
          tone={effectiveTheme === "dark" ? "white" : "brand"}
        />
      </Link>
      <div className="admin-sidebar__scroll">
        {navItems.map(({ item, showGroup }) => {
          const Icon = item.icon;
          const badge = pendingByPath[item.to] ?? null;

          const isActive = item === activeItem;

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
                {badge !== null && badge > 0 && (
                  <>
                    <span className="admin-nav__badge" aria-hidden="true">
                      {badge}
                    </span>
                    <span className="admin-visually-hidden">({badge} pending)</span>
                  </>
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
            <AdminThemeOptions name="admin-sidebar-theme" />
          </details>
          <Link
            className="admin-sidebar__account-link"
            to="/account"
            onClick={() => onNavigate?.()}
          >
            Account
          </Link>
          <Link className="admin-sidebar__account-link" to="/" onClick={() => onNavigate?.()}>
            View site
          </Link>
          <button type="button" onClick={handleSignOut} disabled={signOutState === "pending"}>
            {signOutState === "pending" ? "Signing out…" : "Sign out on this device"}
          </button>
          {signOutState === "error" && (
            <p role="alert" className="admin-sidebar__account-error">
              We couldn't sign you out on this device. Try again.
            </p>
          )}
        </div>
      )}
      {variant === "fixed" && onToggleCollapse && (
        <button
          type="button"
          className="admin-sidebar__collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls={navId}
          title={collapsed ? "Expand sidebar" : undefined}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeft size={16} />}
          <span className="admin-nav__label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      )}
    </nav>
  );
}
