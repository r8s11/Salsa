import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/useTheme";
import { useEscapeKey } from "../features/calendar/hooks/useEscapeKey";
import AdminSidebar from "../components/Admin/AdminSidebar";
import "../styles/admin.css";
import "./AdminLayout.css";

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

const SECTION_LABEL: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/users": "Users",
  "/admin/submissions": "Submissions",
  "/admin/organizer-requests": "Organizer Requests",
  "/admin/venues": "Venues",
};

function sectionLabelFor(pathname: string): string {
  if (SECTION_LABEL[pathname]) return SECTION_LABEL[pathname];
  if (pathname.startsWith("/admin/users/")) return "Users";
  if (pathname.startsWith("/admin/organizer-requests/")) return "Organizer Requests";
  if (pathname.startsWith("/admin/venues/")) return "Venues";
  return SECTION_LABEL["/admin"];
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredCollapsed);
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEscapeKey(closeDrawer);

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
    await signOut();
  };

  const sectionLabel = sectionLabelFor(pathname);
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?";

  return (
    <div className="admin-shell">
      <AdminSidebar
        variant="fixed"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="admin-drawer" data-open={drawerOpen}>
        <div className="admin-drawer__backdrop" onClick={closeDrawer} />
        <AdminSidebar variant="drawer" onNavigate={closeDrawer} />
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
            <span className="admin-breadcrumbs__crumb">Admin</span>
            <ChevronRight size={14} className="admin-breadcrumbs__sep" />
            <span className="admin-breadcrumbs__current">{sectionLabel}</span>
          </nav>
        </div>

        <details className="admin-account">
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
              <fieldset className="admin-account__theme-options">
                <legend className="admin-visually-hidden">Choose theme appearance</legend>
                {(["system", "light", "dark"] as const).map((option) => (
                  <label key={option} className="admin-account__theme-option">
                    <input
                      type="radio"
                      name="admin-theme"
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
            <span className="admin-account__inert-row" aria-disabled="true">
              Account
            </span>
            <Link to="/">View site</Link>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </details>
      </header>

      <main className="admin-main">
        <div className="admin-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
