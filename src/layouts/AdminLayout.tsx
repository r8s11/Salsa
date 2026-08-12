import { useCallback, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useEscapeKey } from "../features/calendar/hooks/useEscapeKey";
import AdminSidebar from "../components/Admin/AdminSidebar";
import "../styles/admin.css";
import "./AdminLayout.css";

const SECTION_LABEL: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/users": "Users",
};

function sectionLabelFor(pathname: string): string {
  if (SECTION_LABEL[pathname]) return SECTION_LABEL[pathname];
  if (pathname.startsWith("/admin/users/")) return "Users";
  return SECTION_LABEL["/admin"];
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEscapeKey(closeDrawer);

  const handleSignOut = async () => {
    await signOut();
  };

  const sectionLabel = sectionLabelFor(pathname);
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?";

  return (
    <div className="admin-shell">
      <AdminSidebar variant="fixed" />
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
          <summary className="admin-account__trigger" aria-label="Account menu">
            <span className="admin-account__avatar">{initial}</span>
          </summary>
          <div className="admin-account__menu">
            {user?.email && <p className="admin-account__email">{user.email}</p>}
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
