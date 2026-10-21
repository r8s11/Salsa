import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { resolveIdentity } from "../../features/account/model/account";
import { useAuth } from "../../contexts/useAuth";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import MetroExplorer from "../../features/metros/components/MetroExplorer";
import SalsaSeguraLogo from "../ui/SalsaSeguraLogo";
import AccountAvatar from "./AccountAvatar";
import ButtonLink from "../ui/ButtonLink";
import { resolveEventCreateDestination } from "../../lib/eventCreateDestination";
import { useCart } from "../../features/shopify/cart/useCart";
import { SHOP_NAV } from "../../features/shopify/collections";
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
  const { pathname } = useLocation();
  const { cart, setOpen: setCartOpen } = useCart();
  const cartCount = cart?.totalQuantity ?? 0;
  const shopRef = useRef<HTMLLIElement>(null);
  const shopTriggerRef = useRef<HTMLAnchorElement>(null);
  // Who opened the panel decides who may close it: hover-opened panels close
  // when the pointer leaves, keyboard-opened ones stay until Escape or focus leaves.
  const shopOpenedBy = useRef<"pointer" | "keyboard">("pointer");
  const focusFirstShopItem = useRef(false);
  const [shopOpen, setShopOpen] = useState(false);
  // The drawer's Shop group starts collapsed, except inside the shop where it
  // shows the current collection.
  const [mobileShopOpen, setMobileShopOpen] = useState(pathname.startsWith("/shop"));
  const [shopPath, setShopPath] = useState(pathname);
  if (shopPath !== pathname) {
    // Route change dismisses the panel (adjusting state during render, not an effect).
    setShopPath(pathname);
    setShopOpen(false);
    setMobileShopOpen(pathname.startsWith("/shop"));
  }
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
    if (shopOpen) {
      // Only pull focus back when it was inside the panel; a hover-opened panel
      // must not steal focus from wherever the user actually is.
      const hadFocus = shopRef.current?.contains(document.activeElement);
      setShopOpen(false);
      if (hadFocus) shopTriggerRef.current?.focus();
    }
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
      if (!(event.target instanceof Node)) return;
      const disclosure = accountDisclosure.current;
      if (disclosure?.open && !disclosure.contains(event.target)) {
        disclosure.removeAttribute("open");
      }
      if (shopRef.current && !shopRef.current.contains(event.target)) setShopOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, []);

  useEffect(() => {
    if (!shopOpen || !focusFirstShopItem.current) return;
    focusFirstShopItem.current = false;
    shopRef.current?.querySelector<HTMLElement>(".shop-menu__link")?.focus();
  }, [shopOpen]);

  const openShop = (by: "pointer" | "keyboard") => {
    shopOpenedBy.current = by;
    setShopOpen(true);
  };

  // The same <li> is a hover/keyboard dropdown on desktop and a collapsible group
  // in the mobile sheet, so none of the open behaviour applies while that sheet is up.
  const handleShopPointer = (event: ReactPointerEvent<HTMLLIElement>, entering: boolean) => {
    if (mobileOpen || event.pointerType === "touch") return;
    if (entering) {
      if (!shopOpen) openShop("pointer");
    } else if (shopOpenedBy.current === "pointer") {
      setShopOpen(false);
    }
  };

  const handleShopKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>) => {
    if (mobileOpen) return;
    const items = Array.from(
      shopRef.current?.querySelectorAll<HTMLElement>(".shop-menu__link") ?? [],
    );
    if (event.target === shopTriggerRef.current) {
      // Enter keeps its native job (navigate to /shop); the panel opens with
      // ArrowDown or Space.
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (shopOpen) items[0]?.focus();
        else {
          focusFirstShopItem.current = true;
          openShop("keyboard");
        }
      } else if (event.key === " ") {
        event.preventDefault();
        if (shopOpen) setShopOpen(false);
        else openShop("keyboard");
      }
      return;
    }
    const index = items.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  };

  const chooseShopDestination = () => {
    setShopOpen(false);
    closeNavigation();
  };

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
          {PRIMARY_LINKS.map(({ to, label }, index) => {
            const ordinal = String(index + 1).padStart(2, "0");
            if (to !== "/shop") {
              return (
                <li key={to}>
                  <NavLink to={to} onClick={closeNavigation}>
                    <span className="nav-links__num" aria-hidden="true">
                      {ordinal}
                    </span>
                    <span className="nav-links__label">{label}</span>
                    <span className="nav-links__marker" aria-hidden="true">
                      ◆
                    </span>
                  </NavLink>
                </li>
              );
            }
            return (
              <li
                key={to}
                ref={shopRef}
                className="nav-links__shop"
                data-mobile-open={mobileShopOpen}
                onPointerEnter={(event) => handleShopPointer(event, true)}
                onPointerLeave={(event) => handleShopPointer(event, false)}
                onKeyDown={handleShopKeyDown}
              >
                <NavLink
                  ref={shopTriggerRef}
                  to={to}
                  aria-controls={mobileOpen ? undefined : "shop-menu"}
                  aria-expanded={mobileOpen ? undefined : shopOpen}
                  onClick={chooseShopDestination}
                >
                  <span className="nav-links__num" aria-hidden="true">
                    {ordinal}
                  </span>
                  <span className="nav-links__label">{label}</span>
                  <ChevronDown size={14} className="nav-links__chevron" aria-hidden="true" />
                  <span className="nav-links__marker" aria-hidden="true">
                    ◆
                  </span>
                </NavLink>
                {mobileOpen && (
                  <button
                    type="button"
                    className="nav-links__shop-toggle"
                    aria-expanded={mobileShopOpen}
                    aria-controls="shop-menu"
                    aria-label="Shop collections"
                    onClick={() => setMobileShopOpen((open) => !open)}
                  >
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                )}
                <div id="shop-menu" className="shop-menu" data-open={shopOpen}>
                  <ul className="shop-menu__list" aria-label="Shop collections">
                    {SHOP_NAV.map((entry) => (
                      <li key={entry.to}>
                        <NavLink
                          to={entry.to}
                          end
                          className="shop-menu__link"
                          aria-label={entry.label}
                          onClick={chooseShopDestination}
                        >
                          <span className="shop-menu__label">{entry.label}</span>
                          <small className="shop-menu__hint">{entry.hint}</small>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <div className="shop-menu__divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="shop-menu__link shop-menu__cart"
                    aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                    onClick={() => {
                      chooseShopDestination();
                      setCartOpen(true);
                    }}
                  >
                    <ShoppingBag size={18} aria-hidden="true" />
                    <span className="shop-menu__label">Cart</span>
                    <small className="shop-menu__hint">
                      {cartCount} {cartCount === 1 ? "item" : "items"}
                    </small>
                  </button>
                </div>
              </li>
            );
          })}
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
