import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isShopifyConfigured, storefront, StorefrontError } from "../api/storefront";
import type { Cart } from "../api/types";
import { CartContext } from "./CartContext";

const STORAGE_KEY = "salsasegura:shopify-cart-id";

export default function CartProvider({ children }: { children: ReactNode }) {
  const [initialCartId] = useState(() => {
    if (!isShopifyConfigured()) return null;
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setLoading] = useState(Boolean(initialCartId));
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const locked = useRef(false);
  const restored = useRef(!initialCartId);
  const mounted = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback(() => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      opener.current = document.activeElement;
    }
  }, []);
  const setOpen = useCallback((open: boolean) => {
    if (open) rememberFocus();
    setIsOpen(open);
  }, [rememberFocus]);
  const restoreFocus = useCallback(() => {
    if (opener.current?.isConnected) opener.current.focus();
  }, []);

  const acceptCart = useCallback((next: Cart | null) => {
    cartRef.current = next;
    if (mounted.current) setCart(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next.id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Shopping still works when browser storage is unavailable; no other data is persisted.
      if (mounted.current) setNotice("Your browser cannot save this cart for your next visit.");
    }
  }, []);

  const loadCart = useCallback((id: string | null): Promise<void> => {
    const request = id ? storefront.getCart(id) : Promise.resolve(null);
    return request.then((next) => {
      if (!mounted.current) return;
      if (id) {
        acceptCart(next);
        if (!next) setNotice("Your previous cart expired. Start a new cart by adding a product.");
      }
      restored.current = true;
    }).catch(() => {
      if (mounted.current) setError("We couldn't load your cart. Try again.");
    }).finally(() => {
      locked.current = false;
      if (mounted.current) setLoading(false);
    });
  }, [acceptCart]);

  const refresh = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    restored.current = false;
    setLoading(true);
    setError(null);
    let id = cartRef.current?.id ?? null;
    if (isShopifyConfigured()) {
      try { id = localStorage.getItem(STORAGE_KEY) ?? id; } catch { /* Storage may be blocked. */ }
    }
    await loadCart(id);
  }, [loadCart]);

  useEffect(() => {
    mounted.current = true;
    if (initialCartId && !locked.current) {
      locked.current = true;
      void loadCart(initialCartId);
    }
    return () => { mounted.current = false; };
  }, [initialCartId, loadCart]);

  const mutate = useCallback(async (
    operation: (current: Cart | null) => Promise<Cart>,
    recoverAdd?: () => Promise<Cart>,
  ): Promise<boolean> => {
    if (locked.current || !restored.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let next: Cart;
      try {
        next = await operation(cartRef.current);
      } catch (failure) {
        if (!(failure instanceof StorefrontError) || failure.kind !== "cart-not-found") throw failure;
        acceptCart(null);
        setNotice("Your previous cart expired.");
        if (!recoverAdd) return false;
        next = await recoverAdd();
      }
      acceptCart(next);
      return true;
    } catch (failure) {
      if (failure instanceof StorefrontError && failure.cart) {
        acceptCart(failure.cart);
        if (failure.kind === "user" && failure.warnings?.length &&
            !failure.userErrors?.length && !failure.graphQLErrors?.length) {
          if (mounted.current) setNotice("Shopify reported a cart adjustment. Review your items before checkout.");
          return true;
        }
      }
      if (mounted.current) setError("We couldn't update your cart. Try again.");
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [acceptCart]);

  const addVariant = useCallback(async (variantId: string, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1) return false;
    // Capture before a pending mutation disables the initiating button and browsers blur it.
    rememberFocus();
    const lines = [{ merchandiseId: variantId, quantity }];
    return mutate(
      (current) => current ? storefront.addCartLines(current.id, lines) : storefront.createCart(lines),
      () => storefront.createCart(lines),
    );
  }, [mutate, rememberFocus]);

  const updateLine = useCallback(async (lineId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || !cartRef.current) return false;
    return mutate((current) => {
      if (!current) throw new Error("Your cart is empty.");
      return quantity === 0
        ? storefront.removeCartLines(current.id, [lineId])
        : storefront.updateCartLines(current.id, [{ id: lineId, quantity }]);
    });
  }, [mutate]);

  const removeLine = useCallback(async (lineId: string) => {
    if (!cartRef.current) return false;
    return mutate((current) => {
      if (!current) throw new Error("Your cart is empty.");
      return storefront.removeCartLines(current.id, [lineId]);
    });
  }, [mutate]);

  return <CartContext.Provider value={{
    cart, isLoading, isBusy, error, notice, isOpen, setOpen, restoreFocus,
    addVariant, updateLine, removeLine, refresh,
  }}>{children}</CartContext.Provider>;
}
