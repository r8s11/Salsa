import { ReactNode, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import "./DashboardShell.css";

export type RailItem = { to: string; label: string; icon: ReactNode; count?: number };
export type RailSection = { title: string; items: RailItem[] };

type Props = {
  /** Breadcrumb shown in the top bar, e.g. "Host · My Events". */
  breadcrumb: string;
  sections: RailSection[];
  initials?: string;
  children: ReactNode;
};

/**
 * Shared chrome for the admin, host, moderator and DJ dashboards:
 * scrolling left rail, top bar with breadcrumb + avatar, and a
 * slide-in section drawer below 1040px.
 */
export default function DashboardShell({
  breadcrumb,
  sections,
  initials = "SM",
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rail = (
    <>
      <Link to="/" className="dash-shell__logo">
        Salsa Segura
      </Link>
      {sections.map((section) => (
        <div key={section.title} className="dash-shell__group">
          <div className="dash-shell__group-title">{section.title}</div>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                isActive ? "dash-shell__item dash-shell__item--active" : "dash-shell__item"
              }
              onClick={() => setDrawerOpen(false)}
            >
              <span className="dash-shell__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="dash-shell__label">{item.label}</span>
              {item.count ? <span className="dash-shell__count">{item.count}</span> : null}
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="dash-shell">
      <aside className="dash-shell__rail">{rail}</aside>

      {drawerOpen && (
        <div className="dash-shell__drawer" role="dialog" aria-modal="true" aria-label="Sections">
          <button
            type="button"
            className="dash-shell__drawer-close"
            aria-label="Close sections"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          {rail}
        </div>
      )}

      <div className="dash-shell__main">
        <header className="dash-shell__topbar">
          <button
            type="button"
            className="dash-shell__burger"
            aria-label="Open sections"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <span className="dash-shell__breadcrumb">{breadcrumb}</span>
          <Link to="/account" className="dash-shell__avatar" aria-label="My account">
            {initials}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
