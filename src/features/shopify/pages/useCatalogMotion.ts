import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/** Catalog-only enhancement. All content is visible before motion initializes. */
export function useCatalogMotion(rootRef: RefObject<HTMLElement | null>, productCount: number) {
  const hasProducts = productCount > 0;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !hasProducts) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // Reuse the site's existing engine rather than adding Locomotive Scroll.
      // Touch stays native; portalled dialogs never enter the smooth-scroll path.
      const lenis = new Lenis({
        duration: 0.85,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -110 },
        prevent: (element) => Boolean(element.closest('[role="dialog"], [data-lenis-prevent]')),
      });
      const tick = (time: number) => lenis.raf(time * 1000);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const context = gsap.context(() => {
        gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
          .from(".retail-hero h1 .retail-word", { y: 22, opacity: 0.75, stagger: 0.07 })
          .from(".retail-hero__image", { scale: 1.035, duration: 1.1 }, 0)
          .from(".retail-hero__copy > p, .retail-hero__copy > a", { y: 10, stagger: 0.06 }, 0.16);
        root.querySelectorAll<HTMLElement>(".retail-catalog__collection, .retail-catalog__closing").forEach((section) => {
          gsap.from(section.querySelectorAll("h2 .retail-word"), {
            y: 14, opacity: 0.65, duration: 0.6, stagger: 0.035,
            scrollTrigger: { trigger: section, start: "top 90%", once: true },
          });
        });
      }, root);

      let alive = true;
      let refreshFrame = 0;
      const refresh = () => {
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => {
          if (alive) { lenis.resize(); ScrollTrigger.refresh(); }
        });
      };
      const pause = () => { lenis.stop(); gsap.ticker.remove(tick); };
      const resume = () => {
        if (document.hidden) return;
        lenis.start();
        gsap.ticker.add(tick);
        refresh();
      };
      const visibility = () => document.hidden ? pause() : resume();
      root.addEventListener("load", refresh, true);
      document.addEventListener("visibilitychange", visibility);
      window.addEventListener("blur", pause);
      window.addEventListener("focus", resume);
      void document.fonts?.ready.then(() => { if (alive) refresh(); });
      refresh();

      return () => {
        alive = false;
        cancelAnimationFrame(refreshFrame);
        root.removeEventListener("load", refresh, true);
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("blur", pause);
        window.removeEventListener("focus", resume);
        context.revert();
        gsap.ticker.remove(tick);
        // Lenis 1.3.26 leaves a delayed native-scroll reset after destroy.
        // Set its scrolling state to false first so that reset cannot re-add
        // root classes on the next route.
        lenis.stop();
        lenis.destroy();
      };
    });
    return () => media.revert();
  }, [rootRef, hasProducts]);
}
