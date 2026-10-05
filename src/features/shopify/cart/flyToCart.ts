// A confirmed add carries the product image into the cart.
export async function flyToCart(source: Element | null): Promise<void> {
  if (!source || !(source instanceof HTMLImageElement)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof source.animate !== "function") return;
  const target = document.querySelector(".shop-page__cart-button");
  if (!target) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return;
  const size = Math.min(from.width, from.height);
  const clone = source.cloneNode(false) as HTMLImageElement;
  clone.removeAttribute("id");
  Object.assign(clone.style, {
    position: "fixed",
    left: `${from.left + (from.width - size) / 2}px`,
    top: `${from.top + (from.height - size) / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    margin: "0",
    // Stay below the cart modal if it opens before the flight finishes.
    zIndex: "1199",
    pointerEvents: "none",
    borderRadius: "12px",
  });
  clone.style.viewTransitionName = "";
  clone.alt = "";
  clone.setAttribute("aria-hidden", "true");
  document.body.append(clone);
  try {
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const flight = clone.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.62 - 72}px) scale(0.6)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.3 },
      ],
      { duration: 720, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)", fill: "forwards" }
    );
    await flight.finished.catch(() => undefined);
    target.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
      { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  } finally {
    clone.remove();
  }
}
