import { Link, NavLink } from "react-router-dom";
import { Icon } from "@iconify/react";
import bagIcon from "@iconify-icons/solar/bag-4-linear";
import { SHOP_NAV } from "../collections";
import { useCart } from "../cart/useCart";
import "./retail-catalog.css";

/** "Shop" wordmark, collection row and cart, shared by the landing and every collection. */
export default function ShopMasthead() {
  const { cart, setOpen } = useCart();
  const quantity = cart?.totalQuantity ?? 0;
  return (
    <header className="retail-catalog__header">
      <Link to="/shop" className="retail-catalog__identity">Shop</Link>
      <nav className="retail-catalog__nav" aria-label="Shop collections">
        {SHOP_NAV.map((entry) => (
          <NavLink key={entry.to} to={entry.to} end>{entry.label}</NavLink>
        ))}
      </nav>
      <button
        className="retail-catalog__cart shop-page__cart-button"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open cart, ${quantity} ${quantity === 1 ? "item" : "items"}`}
      >
        <Icon icon={bagIcon} aria-hidden="true" width={21} />
        <span>Cart</span>
        <span className="retail-catalog__cart-count" aria-live="polite">{quantity}</span>
      </button>
    </header>
  );
}
