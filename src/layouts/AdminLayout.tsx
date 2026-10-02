import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import AdminThemeOptions from "../components/Admin/AdminThemeOptions";
import AdminSidebar from "../components/Admin/AdminSidebar";
import { useAccessibleDialog } from "../shared/a11y/useAccessibleDialog";
import SkipLink from "../shared/a11y/SkipLink";
import "../styles/admin.css";
import "./AdminLayout.css";

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

const SECTION_LABEL: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/events/import": "Bulk Upload",
  "/admin/events/import-flyers": "Events · Import Flyers",
  "/admin/users": "Users",
  "/admin/submissions": "Event Submissions",
  "/admin/organizer-requests": "Organizer Requests",
  "/admin/founder-requests": "Founder Requests",
  "/admin/venues": "Venues",
  "/admin/tags": "Tags",
  "/admin/activity": "Activity",
  "/admin/analytics": "Analytics",
  "/admin/settings": "Settings",
  "/host": "Host · Dashboard",
  "/host/events": "Host · My Events",
  "/host/events/new": "Host · New Event",
  "/host/events/import": "Host · Import Events",
  "/host/events/import-flyers": "Host · Import Flyers",
  "/host/organization": "Host · Organization",
};

/**
 * Trailing segments of /host/events/:eventId routes. Checked before the
 * broad event-detail fallback so a nested action never reports itself as
 * "Event Details".
 */
const HOST_EVENT_CHILD_LABEL: Record<string, string> = {
  edit: "Host · Edit Event",
  attendees: "Host · Attendees",
  "check-in": "Host · Check-in",
};

function sectionLabelFor(pathname: string): string {
  if (SECTION_LABEL[pathname]) return SECTION_LABEL[pathname];
  if (pathname.startsWith("/host/events/")) {
    const trailing = pathname.split("/").filter(Boolean).slice(3).join("/");
    return HOST_EVENT_CHILD_LABEL[trailing] ?? "Host · Event Details";
  }
  if (pathname === "/host" || pathname.startsWith("/host/")) return SECTION_LABEL["/host"];
  let sectionPath = "/admin";
  for (const path in SECTION_LABEL) {
    if (path.length > sectionPath.length && pathname.startsWith(`${path}/`)) {
      sectionPath = path;
    }
  }
  return SECTION_LABEL[sectionPath];
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredCollapsed);
  const [signOutState, setSignOutState] = useState<"idle" | "pending" | "error">("idle");
  const accountRef = useRef<HTMLDetailsElement>(null);
  const signOutRef = useRef<HTMLDivElement>(null);
  const closeAccount = useCallback((restoreFocus = false) => {
    const account = accountRef.current;
    if (!account?.open) return;
    account.open = false;
    if (restoreFocus) account.querySelector("summary")?.focus();
  }, []);
  const { pathname } = useLocation();
  const { user, role, signOut } = useAuth();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const drawerRef = useRef<HTMLDivElement>(null);
  const {
    onKeyDown: onDrawerKeyDown,
    onBackdropClick: onDrawerBackdropClick,
    onDialogClick: onDrawerDialogClick,
  } = useAccessibleDialog({
    dialogRef: drawerRef,
    isOpen: drawerOpen,
    onDismiss: closeDrawer,
  });
  useEffect(() => {
    const dismissOutside = (event: Event) => {
      const account = accountRef.current;
      if (account?.open && !account.contains(event.target as Node)) closeAccount();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [closeAccount]);
  useEffect(() => closeAccount(), [pathname, closeAccount]);
  useLayoutEffect(() => {
    if (signOutState === "error" && accountRef.current?.open) {
      signOutRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [signOutState]);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  useLayoutEffect(() => {
    const pending = document.documentElement.dataset.pendingAdminTheme;
    if (pending) {
      document.querySelector(".admin-shell")?.setAttribute("data-theme", pending);
      delete document.documentElement.dataset.pendingAdminTheme;
    }
  }, []);

  const handleSignOut = async () => {
    if (signOutState === "pending") return;
    setSignOutState("pending");
    try {
      const { error } = await signOut("global");
      setSignOutState(error ? "error" : "idle");
      if (!error) closeAccount(true);
    } catch {
      setSignOutState("error");
    }
  };
  const sectionLabel = sectionLabelFor(pathname);
  const rolePrefix =
    role === "moderator" ? "Moderator" : role === "organizer" ? "Organizer" : "Admin";
  const isHostRoute = pathname === "/host" || pathname.startsWith("/host/");
  const breadcrumbLabel = isHostRoute
    ? sectionLabel
    : pathname === "/admin"
      ? `${rolePrefix} · ${sectionLabel}`
      : sectionLabel;
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?";
  // Host and Admin share this shell; the mode drives the navigation landmark
  // name. Below 1024px both modes navigate through the labelled drawer; the
  // fixed sidebar (and its user-collapsible rail) appears at 1024px.
  const mode = isHostRoute ? "host" : "admin";

  return (
    <div className="admin-shell" data-mode={mode} data-collapsed={sidebarCollapsed}>
      <SkipLink targetId="admin-main">Skip to content</SkipLink>
      <AdminSidebar
        variant="fixed"
        mode={mode}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="admin-drawer" data-open={drawerOpen} onClick={onDrawerBackdropClick}>
        <div
          ref={drawerRef}
          className="admin-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          tabIndex={-1}
          onKeyDown={onDrawerKeyDown}
          onClick={onDrawerDialogClick}
        >
          <button
            type="button"
            className="admin-drawer__close"
            onClick={closeDrawer}
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <AdminSidebar variant="drawer" mode={mode} onNavigate={closeDrawer} />
        </div>
      </div>

      <header className="admin-topbar">
        <div className="admin-topbar__left">
          <button
            type="button"
            className="admin-topbar__burger"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>
          <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
            {!isHostRoute && pathname !== "/admin" && (
              <>
                <span className="admin-breadcrumbs__crumb">{rolePrefix}</span>
                <ChevronRight size={14} className="admin-breadcrumbs__sep" />
              </>
            )}
            <span className="admin-breadcrumbs__crumb admin-breadcrumbs__current">
              {breadcrumbLabel}
            </span>
          </nav>
        </div>

        <details
          ref={accountRef}
          className="admin-account"
          onToggle={(event) => {
            if (
              event.target === event.currentTarget &&
              event.currentTarget.open &&
              signOutState === "error"
            ) {
              signOutRef.current?.scrollIntoView({ block: "nearest" });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && accountRef.current?.open) {
              event.preventDefault();
              event.stopPropagation();
              closeAccount(true);
            }
          }}
        >
          <summary className="admin-account__trigger" role="button" aria-label="Account menu">
            <span className="admin-account__avatar">{initial}</span>
          </summary>
          <div className="admin-account__menu">
            {user?.email && (
              <div className="admin-account__identity">
                <p className="admin-account__email">{user.email}</p>
              </div>
            )}
            <details className="admin-account__appearance">
              <summary>
                Appearance
                <ChevronRight size={14} />
              </summary>
              <AdminThemeOptions name="admin-theme" />
            </details>
            <Link to="/account" onClick={() => closeAccount()}>
              Account
            </Link>
            <Link to="/" onClick={() => closeAccount()}>
              View site
            </Link>
            <div ref={signOutRef}>
              {signOutState === "error" && (
                <p role="alert" className="admin-account__error">
                  We couldn't sign you out on all devices. Try again.
                </p>
              )}
              <button type="button" onClick={handleSignOut} disabled={signOutState === "pending"}>
                {signOutState === "pending" ? "Signing out…" : "Sign out on all devices"}
              </button>
            </div>
          </div>
        </details>
      </header>

      <main id="admin-main" className="admin-main" tabIndex={-1}>
        <div className="admin-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
