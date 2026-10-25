import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { storefront } from "../api/storefront";
import type { ProductSummary, ProductVariant } from "../api/types";
import { formatMoney } from "../money";

let productModule: Promise<unknown> | undefined;

export default function ProductLink({ product, className, children }: {
  product: ProductSummary;
  className?: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mounted = useRef(true);
  const preloaded = useRef<Promise<void> | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const href = `/shop/products/${encodeURIComponent(product.handle)}`;
  const prepare = async () => {
    productModule ??= import("./ProductPage");
    const [detail] = await Promise.all([
      queryClient.ensureQueryData({ queryKey: ["shopify", "product", product.handle], queryFn: () => storefront.getProduct(product.handle) }),
      productModule,
    ]);
    const image = detail?.variants.nodes.find((variant: ProductVariant) => variant.availableForSale)?.image ?? detail?.featuredImage;
    if (image) {
      const decoded = new Image();
      decoded.src = image.url;
      await decoded.decode().catch(() => undefined);
    }
  };
  const preload = () => preloaded.current ??= prepare();
  const openProduct = () => new Promise<void>((resolve) => {
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      const heading = document.querySelector<HTMLElement>(".shop-page--product #product-heading");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (document.querySelector(".shop-product #product-heading, .shop-state--error #product-heading")) done();
    });
    const timeout = window.setTimeout(done, 4000);
    observer.observe(document.getElementById("root") ?? document.body, { childList: true, subtree: true });
    navigate(href);
  });
  const follow = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await openProduct();
      return;
    }
    if (pending) return;
    const link = event.currentTarget;
    const originalPath = window.location.pathname;
    setPending(true);
    try {
      await preload();
    } catch {
      // The real product route owns the visible fetch/error state.
      if (mounted.current && window.location.pathname === originalPath) await openProduct();
      return;
    } finally {
      if (mounted.current) setPending(false);
    }
    if (!mounted.current || window.location.pathname !== originalPath) return;
    const image = link.querySelector<HTMLImageElement>("img");
    if (!image?.complete || !image.naturalWidth) {
      await openProduct();
      return;
    }
    image.style.viewTransitionName = "shop-product";
    document.documentElement.classList.add("shop-transition-active");
    const transition = document.startViewTransition(openProduct);
    // Unsupported snapshot conditions skip motion, not navigation.
    void transition.finished.catch(() => undefined).finally(() => {
      image.style.viewTransitionName = "";
      document.documentElement.classList.remove("shop-transition-active");
    });
  };

  return <Link to={href} className={className} aria-label={`${product.title}, starting at ${formatMoney(product.priceRange.minVariantPrice)}`} aria-busy={pending || undefined}
    onPointerEnter={() => { void preload().catch(() => undefined); }}
    onFocus={() => { void preload().catch(() => undefined); }}
    onClick={(event) => { void follow(event); }}>{children}</Link>;
}
