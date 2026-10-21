import { CalendarDays, Home, ShoppingBag, Store, User } from "lucide-react";
import { matchPath, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import { metroShortCode } from "../../features/metros/model/metro";
import { useCart } from "../../features/shopify/cart/useCart";
import Dock, { type DockItemData } from "./Dock";
import GlassSurface from "./GlassSurface";
import "./MobileTabBar.css";

function MobileTabBar() {
  const { user } = useAuth();
  const { city } = useCity();
  const metroName = useMetroName();
  const { pathname } = useLocation();
  const { cart, setOpen: setCartOpen } = useCart();
  const cartCount = cart?.totalQuantity ?? 0;

  // Discovery first. The third tab is the way into the shop, and once inside
  // it becomes the cart, which opens in place. Submitting an event lives in
  // the header drawer, which also remains the home of identity, dashboards
  // and sign-out. The city badge carries context without spending a label
  // box at 320px.
  const inShop = pathname === "/shop" || pathname.startsWith("/shop/");
  const tabs: DockItemData[] = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, end: false },
    inShop
      ? {
          id: "cart",
          label: "Cart",
          icon: ShoppingBag,
          onSelect: () => setCartOpen(true),
          badge: cartCount,
          ariaLabel: `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`,
        }
      : { to: "/shop", label: "Shop", icon: Store, end: false },
    { to: user ? "/profile" : "/signin", label: "Me", icon: User, end: false },
  ];
  const activeTab = tabs.find(
    (tab) => "to" in tab && matchPath({ path: tab.to.split("?")[0], end: tab.end }, pathname)
  );
  const activeValue = activeTab && "to" in activeTab ? activeTab.to : undefined;

  // No metro chosen yet (resolving, or the visitor has no active metro
  // nearby): the badge stays a neutral "Cities" rather than guessing.
  const cityFull = city ? metroName(city) : "Cities";
  const cityShort = city ? metroShortCode(cityFull) : "Cities";

  return (
    <nav className="mobile-tab-bar" aria-label={`Primary, ${cityFull} events`}>
      <span className="mobile-tab-bar__city" aria-hidden="true">
        {cityShort}
      </span>
      <GlassSurface className="mobile-tab-bar__glass" height={70} backgroundOpacity={0.56}>
        <Dock items={tabs} activeValue={activeValue} />
      </GlassSurface>
    </nav>
  );
}

export default MobileTabBar;
