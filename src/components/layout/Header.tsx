import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutDashboard, LogOut, Settings2, UserRound } from "lucide-react";
import { resolveIdentity } from "../../features/account/model/account";
import { useAuth } from "../../contexts/useAuth";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import MetroExplorer from "../../features/metros/components/MetroExplorer";
import SalsaSeguraLogo from "../ui/SalsaSeguraLogo";
import AccountAvatar from "./AccountAvatar";
import ButtonLink from "../ui/ButtonLink";
import { resolveEventCreateDestination } from "../../lib/eventCreateDestination";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./Header.css";

const PRIMARY_LINKS = [
  { to: "/calendar", label: "Calendar" },
  { to: "/discover", label: "Discover" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/shop", label: "Shop" },
] as const;

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const accountDisclosure = useRef<HTMLDetailsElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { user, isModerator, isAdmin, isOrganizer, signOut } = useAuth();
  const { profile } = useOwnProfile(user?.id);
  const navigate = useNavigate();
  const identity = resolveIdentity({
    display_name: profile?.display_name ?? null,
    username: profile?.username ?? null,
  });
  const roleLabel = isAdmin
    ? "Admin"
    : isModerator
      ? "Moderator"
      : isOrganizer
        ? "Organizer"
        : "Member";
  // Admins author platform events directly; everyone else uses the moderated
  // public submission flow.
  const eventCreateTo = resolveEventCreateDestination(isAdmin ? "admin" : null);

  // Labelled by which dashboard they open — the group heading already says
  // "Dashboard", so repeating the word in every item reads as a stutter.
  const dashboardLinks: ReadonlyArray<{ to: string; label: string }> = [
    ...(isOrganizer ? [{ to: "/host", label: "Host" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
    ...(!isAdmin && isModerator ? [{ to: "/admin", label: "Moderator" }] : []),
  ];

  const closeNavigation = useCallback(() => {
    setMobileOpen(false);
    accountDisclosure.current?.removeAttribute("open");
  }, []);

  useEscapeKey(() => {
    const wasAccountOpen = accountDisclosure.current?.open;
    closeNavigation();
    if (wasAccountOpen) accountDisclosure.current?.querySelector("summary")?.focus();
  });
  const { onKeyDown: onNavigationKeyDown } = useAccessibleDialog({
    dialogRef: navigationRef,
    initialFocusRef: menuButtonRef,
    isOpen: mobileOpen,
    onDismiss: closeNavigation,
  });

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) closeNavigation();
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, [closeNavigation]);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      const disclosure = accountDisclosure.current;
      if (disclosure?.open && event.target instanceof Node && !disclosure.contains(event.target)) {
        disclosure.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, []);

  const handleSignOut = async () => {
    if (signOutPending) return;
    setSignOutPending(true);
    setSignOutError(null);
    try {
      const result = await signOut("global");
      if (result?.error) {
        setSignOutError("We couldn't sign you out. Please try again.");
        return;
      }
      closeNavigation();
      navigate("/");
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
    } finally {
      setSignOutPending(false);
    }
  };

  return (
    <div
      ref={navigationRef}
      className="site-header"
      role={mobileOpen ? "dialog" : "banner"}
      aria-modal={mobileOpen ? true : undefined}
      aria-label={mobileOpen ? "Site navigation" : undefined}
      onKeyDown={onNavigationKeyDown}
    >
      <nav className="container" aria-label="Main navigation">
        <Link to="/" className="logo" onClick={closeNavigation}>
          <SalsaSeguraLogo variant="full" size="lg" tone="brand" />
        </Link>

        <ul id="site-navigation" className={`nav-links ${mobileOpen ? "active" : ""}`}>
          {PRIMARY_LINKS.map(({ to, label }, index) => (
            <li key={to}>
              <NavLink to={to} onClick={closeNavigation}>
                <span className="nav-links__num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="nav-links__label">{label}</span>
                <span className="nav-links__marker" aria-hidden="true">
                  ◆
                </span>
              </NavLink>
            </li>
          ))}
          <li className="mobile-nav-actions">
            <span className="mobile-nav__context">Explore Salsa Segura</span>
            <section className="mobile-nav__city" aria-labelledby="mobile-nav-city-label">
              <span id="mobile-nav-city-label" className="mobile-nav__label">
                Your city
              </span>
              <MetroExplorer
                variant="button"
                className="metro-explorer--full"
                onPicked={closeNavigation}
              />
            </section>
            <section className="mobile-nav__account" aria-labelledby="mobile-nav-account-label">
              <span id="mobile-nav-account-label" className="mobile-nav__label">
                Account
              </span>
              {user ? (
                <>
                  <ButtonLink to={eventCreateTo} size="compact" onClick={closeNavigation}>
                    {isAdmin ? "Add Event" : "Submit Event"}
                  </ButtonLink>
                  {dashboardLinks.length > 0 && (
                    <div className="mobile-nav__dashboards">
                      <span className="mobile-nav__dashboards-label">Dashboard</span>
                      {dashboardLinks.map(({ to, label }) => (
                        <NavLink key={to} to={to} onClick={closeNavigation}>
                          <LayoutDashboard size={18} aria-hidden="true" />
                          {label}
                          <ChevronRight
                            size={16}
                            className="account-menu__arrow"
                            aria-hidden="true"
                          />
                        </NavLink>
                      ))}
                    </div>
                  )}
                  <NavLink to="/account" className="mobile-nav__identity" onClick={closeNavigation}>
                    <AccountAvatar
                      avatarUrl={profile?.avatar_url}
                      displayName={profile?.display_name}
                      username={profile?.username}
                      email={user.email}
                    />
                    <span className="mobile-nav__identity-text">
                      <span className="mobile-nav__identity-name">{identity.name}</span>
                      {user.email && (
                        <span className="mobile-nav__identity-email">{user.email}</span>
                      )}
                    </span>
                    <span className="mobile-nav__identity-cta" aria-hidden="true">
                      Account
                    </span>
                  </NavLink>
                  <NavLink
                    to="/profile"
                    className="account-menu__row"
                    aria-label="My Profile"
                    onClick={closeNavigation}
                  >
                    <UserRound size={20} aria-hidden="true" />
                    <span className="account-menu__row-copy">
                      <strong>My Profile</strong>
                      <small>Your profile and activity</small>
                    </span>
                    <ChevronRight size={16} className="account-menu__arrow" aria-hidden="true" />
                  </NavLink>
                  <button
                    type="button"
                    className="drawer-sign-out account-menu__row account-menu__signout"
                    aria-label="Sign Out"
                    onClick={handleSignOut}
                    disabled={signOutPending}
                  >
                    <LogOut size={20} aria-hidden="true" />
                    <span className="account-menu__row-copy">
                      <strong>{signOutPending ? "Signing out…" : "Sign Out"}</strong>
                      <small>On all devices</small>
                    </span>
                  </button>
                  {mobileOpen && signOutError && (
                    <p className="account-menu__error" role="alert">
                      {signOutError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
                    Submit Event
                  </ButtonLink>
                  <ButtonLink
                    to="/signin"
                    size="compact"
                    variant="secondary"
                    onClick={closeNavigation}
                  >
                    Sign In
                  </ButtonLink>
                </>
              )}
            </section>
          </li>
        </ul>

        <MetroExplorer variant="compact" className="metro-explorer--end" />

        <div className="desktop-nav-actions">
          {user ? (
            <ButtonLink to={eventCreateTo} size="compact" onClick={closeNavigation}>
              {isAdmin ? "Add Event" : "Submit Event"}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/submit" size="compact" onClick={closeNavigation}>
                Submit Event
              </ButtonLink>
              <ButtonLink to="/signin" size="compact" onClick={closeNavigation}>
                Sign In
              </ButtonLink>
            </>
          )}
        </div>

        {user && (
          <details ref={accountDisclosure} className="account-disclosure">
            <summary aria-label="Open account menu">
              <AccountAvatar
                avatarUrl={profile?.avatar_url}
                displayName={profile?.display_name}
                username={profile?.username}
                email={user.email}
              />
            </summary>
            <div className="account-disclosure__menu">
              <div className="account-menu__identity">
                <AccountAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={profile?.display_name}
                  username={profile?.username}
                  email={user.email}
                  size={48}
                />
                <div className="account-menu__identity-copy">
                  <strong className="account-menu__name" title={identity.name}>
                    {identity.name}
                  </strong>
                  {user.email && (
                    <span className="account-menu__email" title={user.email}>
                      {user.email}
                    </span>
                  )}
                  <span className="account-menu__role">{roleLabel}</span>
                </div>
              </div>
              {dashboardLinks.length > 0 && (
                <div className="account-disclosure__dashboards">
                  <span className="account-disclosure__dashboards-label">Dashboard</span>
                  {dashboardLinks.map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="account-menu__row account-menu__dashboard"
                      aria-label={label}
                      onClick={closeNavigation}
                    >
                      <LayoutDashboard size={20} aria-hidden="true" />
                      <span className="account-menu__row-copy">
                        <strong>{label}</strong>
                        <small>Open your dashboard</small>
                      </span>
                      <ChevronRight size={16} className="account-menu__arrow" aria-hidden="true" />
                    </NavLink>
                  ))}
                </div>
              )}
              <div className="account-menu__links">
                <NavLink
                  to="/account"
                  className="account-menu__row"
                  aria-label="My Account"
                  onClick={closeNavigation}
                >
                  <Settings2 size={20} aria-hidden="true" />
                  <span className="account-menu__row-copy">
                    <strong>My Account</strong>
                    <small>Settings and preferences</small>
                  </span>
                  <ChevronRight size={16} className="account-menu__arrow" aria-hidden="true" />
                </NavLink>
                <NavLink
                  to="/profile"
                  className="account-menu__row"
                  aria-label="My Profile"
                  onClick={closeNavigation}
                >
                  <UserRound size={20} aria-hidden="true" />
                  <span className="account-menu__row-copy">
                    <strong>My Profile</strong>
                    <small>Your profile and activity</small>
                  </span>
                  <ChevronRight size={16} className="account-menu__arrow" aria-hidden="true" />
                </NavLink>
              </div>
              <div className="account-menu__footer">
                <button
                  type="button"
                  className="account-menu__row account-menu__signout"
                  aria-label="Sign Out"
                  onClick={handleSignOut}
                  disabled={signOutPending}
                >
                  <LogOut size={20} aria-hidden="true" />
                  <span className="account-menu__row-copy">
                    <strong>{signOutPending ? "Signing out…" : "Sign Out"}</strong>
                    <small>On all devices</small>
                  </span>
                </button>
                {signOutError && (
                  <p className="account-menu__error" role="alert">
                    {signOutError}
                  </p>
                )}
              </div>
            </div>
          </details>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          className={`hamburger ${mobileOpen ? "active" : ""}`}
          onClick={() => setMobileOpen((open) => !open)}
          aria-controls="site-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </div>
  );
}

export default Header;
