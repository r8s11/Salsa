import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom exposes scrollTo but does not implement viewport scrolling.
// Keep this test-only; individual tests can assert or override the mock.
window.scrollTo = vi.fn();

// jsdom 28 + Node >=25 leaves window.localStorage/sessionStorage undefined
// (Node's experimental webstorage requires --localstorage-file). Component
// code reads/writes localStorage on mount (CityContext, AdminLayout), so the
// storage APIs are polyfilled when the environment does not provide them.
function polyfillWebStorage(prop: "localStorage" | "sessionStorage") {
  if (typeof window === "undefined" || window[prop] !== undefined) return;
  let store = new Map<string, string>();
  Object.defineProperty(window, prop, {
    configurable: true,
    writable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, String(value)),
    },
  });
}
polyfillWebStorage("localStorage");
polyfillWebStorage("sessionStorage");

// jsdom has no media-query evaluator. Install before component imports so
// GSAP/ScrollTrigger can register; media-sensitive tests can override it.
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const target = new EventTarget();
      return Object.assign(target, {
        matches: false,
        media: query,
        onchange: null,
        addListener: (listener: MediaQueryList["onchange"]) =>
          target.addEventListener("change", listener as globalThis.EventListener | null),
        removeListener: (listener: MediaQueryList["onchange"]) =>
          target.removeEventListener("change", listener as globalThis.EventListener | null),
      });
    },
  });
}
