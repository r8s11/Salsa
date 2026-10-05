import * as Dialog from "@radix-ui/react-dialog";
import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import Button from "../../../components/ui/Button";
import ButtonLink from "../../../components/ui/ButtonLink";
import { formatMoney } from "../money";
import { useCart } from "./useCart";
import "./cart.css";
import "./retail-cart.css";

const isValidCheckoutUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

type CartAction = "increase" | "decrease" | "remove";
interface LineIdentity {
  id: string;
  variantId: string;
}
interface MutationFocus {
  line: LineIdentity;
  action: CartAction;
  source: HTMLButtonElement;
  survivors: LineIdentity[];
}

export default function CartDrawer() {
  const { cart, isLoading, isBusy, error, notice, isOpen, setOpen, restoreFocus, updateLine, removeLine, refresh } = useCart();
  const controls = useRef<Map<string, HTMLElement> | null>(null);
  const pendingFocus = useRef<MutationFocus | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const browse = useRef<HTMLAnchorElement>(null);

  function rememberControl(key: string, element: HTMLElement | null) {
    if (element) {
      controls.current ??= new Map();
      controls.current.set(key, element);
    } else {
      controls.current?.delete(key);
    }
  }

  function changeLine(id: string, action: CartAction, source: HTMLButtonElement) {
    if (isBusy || isLoading) return;
    const lines = cart?.lines.nodes ?? [];
    const index = lines.findIndex((line) => line.id === id);
    const line = lines[index];
    if (!line) return;
    if (document.activeElement === source) {
      pendingFocus.current = {
        line: { id, variantId: line.merchandise.id }, action, source,
        // Prefer the following line, then the preceding line, using data identities.
        survivors: [...lines.slice(index + 1), ...lines.slice(0, index).reverse()]
          .map((item) => ({ id: item.id, variantId: item.merchandise.id })),
      };
    }
    if (action === "remove") void removeLine(id);
    else void updateLine(id, line.quantity + (action === "increase" ? 1 : -1));
  }

  useLayoutEffect(() => {
    const intent = pendingFocus.current;
    if (!isOpen) {
      pendingFocus.current = null;
      return;
    }
    if (!intent || isLoading) return;
    if (isBusy) {
      // Native disabled buttons blur. Keep focus in this line while it is locked.
      controls.current?.get(`${intent.line.id}:group`)?.focus();
      return;
    }
    const lines = cart?.lines.nodes ?? [];
    function findLine(identity: LineIdentity, allowVariantMatch = true) {
      const exact = lines.find((line) => line.id === identity.id);
      if (exact || !allowVariantMatch) return exact;
      const matches = lines.filter((line) => line.merchandise.id === identity.variantId);
      return matches.length === 1 ? matches[0] : undefined;
    }
    function enabledControl(id: string, action: CartAction) {
      const element = controls.current?.get(`${id}:${action}`);
      return element?.isConnected && !(element instanceof HTMLButtonElement && element.disabled)
        ? element : undefined;
    }
    const sameLine = findLine(intent.line, intent.action !== "remove");
    let target = sameLine && (
      enabledControl(sameLine.id, intent.action)
      ?? enabledControl(sameLine.id, "increase")
      ?? enabledControl(sameLine.id, "remove")
    );
    for (const identity of intent.survivors) {
      if (target) break;
      const survivor = findLine(identity);
      if (survivor) target = enabledControl(survivor.id, "increase") ?? enabledControl(survivor.id, "remove");
    }
    pendingFocus.current = null;
    (target ?? browse.current ?? close.current)?.focus();
  }, [cart, isBusy, isLoading, isOpen]);

  return <Dialog.Root open={isOpen} onOpenChange={setOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className="shop-cart-overlay" />
      <Dialog.Content ref={dialog} className="shop-cart" aria-busy={isBusy || isLoading} onFocusCapture={(event) => {
        const intent = pendingFocus.current;
        const target = event.nativeEvent.target;
        if (intent && target !== intent.source && target !== dialog.current
          && target !== controls.current?.get(`${intent.line.id}:group`)) {
          // A deliberate move within the dialog wins over mutation restoration.
          pendingFocus.current = null;
        }
      }} onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}>
        <div className="shop-cart__heading">
          <Dialog.Title>Your cart</Dialog.Title>
          <Dialog.Close asChild><Button ref={close} variant="ghost" size="compact" aria-label="Close cart">Close</Button></Dialog.Close>
        </div>
        <Dialog.Description>Review your items. Payment and delivery are handled by Shopify.</Dialog.Description>
        {isLoading && <p role="status">Loading your cart…</p>}
        {isBusy && <p role="status">Updating your cart…</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <div className="shop-cart__error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" disabled={isLoading || isBusy} onClick={() => void refresh()}>Reload cart</Button>
        </div>}
        {!isLoading && !error && !cart?.lines.nodes.length && <div className="shop-cart__empty">
          <p>Your cart is ready for the first dance.</p>
          <ButtonLink ref={browse} variant="secondary" to="/shop" onClick={() => setOpen(false)}>Browse the shop</ButtonLink>
        </div>}
        <ul className="shop-cart__lines" aria-label="Cart items" aria-busy={isBusy}>
          {cart?.lines.nodes.map((line) => {
            const options = line.merchandise.selectedOptions ?? [];
            const variantLabel = options.length
              ? options.map(({ name, value }) => `${name}: ${value}`).join(" / ")
              : line.merchandise.title;
            const label = `${line.merchandise.product.title}, ${variantLabel}`;
            return <li key={line.id} className="shop-cart__line">
              {line.merchandise.image
                ? <img src={line.merchandise.image.url} alt={line.merchandise.image.altText ?? ""} width="80" height="80" />
                : <span className="shop-cart__image-placeholder" role="img" aria-label="Product image unavailable">Image unavailable</span>}
              <div className="shop-cart__details">
                <Link to={`/shop/products/${encodeURIComponent(line.merchandise.product.handle)}`} onClick={() => setOpen(false)}>{line.merchandise.product.title}</Link>
                <p>{variantLabel}</p>
                {!line.merchandise.availableForSale && <p>Currently sold out</p>}
                <p>{formatMoney(line.cost.totalAmount)}</p>
                <div className="shop-cart__quantity" role="group" aria-label={`Quantity controls for ${label}`} tabIndex={-1} ref={(element) => rememberControl(`${line.id}:group`, element)}>
                  <Button ref={(element) => rememberControl(`${line.id}:decrease`, element)} variant="secondary" size="compact" aria-label={`Decrease quantity of ${label}`} disabled={isBusy || isLoading || line.quantity <= 1} onClick={(event) => changeLine(line.id, "decrease", event.currentTarget)}><Minus size={18} aria-hidden="true" /></Button>
                  <output aria-label={`Quantity of ${label}`} aria-live="polite">{line.quantity}</output>
                  <Button ref={(element) => rememberControl(`${line.id}:increase`, element)} variant="secondary" size="compact" aria-label={`Increase quantity of ${label}`} disabled={isBusy || isLoading || !line.merchandise.availableForSale} onClick={(event) => changeLine(line.id, "increase", event.currentTarget)}><Plus size={18} aria-hidden="true" /></Button>
                  <Button ref={(element) => rememberControl(`${line.id}:remove`, element)} variant="ghost" size="compact" aria-label={`Remove ${label}`} disabled={isBusy || isLoading} onClick={(event) => changeLine(line.id, "remove", event.currentTarget)}>Remove</Button>
                </div>
              </div>
            </li>;
          })}
        </ul>
        {!!cart?.lines.nodes.length && <div className="shop-cart__summary">
          <dl>
            <div><dt>Items</dt><dd aria-live="polite">{cart.totalQuantity}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatMoney(cart.cost.subtotalAmount)}</dd></div>
            <div><dt>Estimated total</dt><dd>{formatMoney(cart.cost.totalAmount)}</dd></div>
          </dl>
          <p>Shipping, taxes, and discounts are finalized at checkout.</p>
          {!isBusy && !isLoading && !error && isValidCheckoutUrl(cart.checkoutUrl) && <a className="ui-button ui-button--primary ui-button--block" href={cart.checkoutUrl}>Checkout with Shopify</a>}
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
