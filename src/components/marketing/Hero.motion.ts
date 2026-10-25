import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

/**
 * Homepage hero motion.
 *
 * Lenis is the site's smooth-scroll engine, but only on pages that opt in
 * (`AboutPage.motion.ts`, `useCatalogMotion.ts`). The homepage stays on
 * native scroll so this section must not construct a second engine — and
 * must not pull in Locomotive Scroll. No scrubbed pin: the vinyl already
 * owns a centering transform, and a pinned hero would cover the events list.
 *
 * Three.js is not used. The record is the focal asset and already spins in
 * CSS; a canvas would fight the printed label and the centering transform.
 *
 * Two timelines, two lifetimes:
 *  - text re-plays when the heading changes (city / route switch);
 *  - the record's intro plays once per mount, so picking a city never
 *    restarts a disc that is already turning.
 *
 * Text is painted at rest in CSS. These hooks only run when motion is
 * allowed and never set opacity to 0 on copy — the heading and CTAs stay
 * readable throughout. Reduced motion never adds `hero--motion`, so the
 * unsplit source stays visible and the record rests.
 */
export function useHeroMotion(heroRef: RefObject<HTMLElement | null>, headingKey: string) {
  // Text: word-by-word rise, then eyebrow / subtitle / actions behind it.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof window.matchMedia !== "function") return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      hero.classList.add("hero--motion");

      const ctx = gsap.context(() => {
        const words = hero.querySelectorAll(".hero-split-word");
        const support = hero.querySelectorAll(
          '[data-enter="eyebrow"], [data-enter="subtitle"], [data-enter="cta"]'
        );
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

        if (words.length) {
          tl.from(words, { yPercent: 45, opacity: 0.35, duration: 0.9, stagger: 0.07 }, 0);
        }
        if (support.length) {
          tl.from(support, { y: 14, opacity: 0.6, duration: 0.6, stagger: 0.08 }, 0.25);
        }

        tl.eventCallback("onComplete", () => {
          gsap.set([...words, ...support], { clearProps: "transform,opacity" });
        });
      }, hero);

      return () => {
        ctx.revert();
        hero.classList.remove("hero--motion");
      };
    });

    return () => media.revert();
  }, [heroRef, headingKey]);

  // Record: the disc spins up from a fast settle to its resting speed while
  // the glow and the light on it come up. The disc's rotation lives in a CSS
  // animation, so its playback rate is eased rather than its transform
  // (GSAP never writes a transform the record's centring depends on).
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof window.matchMedia !== "function") return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const glow = hero.querySelector(".hero-vinyl__glow");
      const glint = hero.querySelector(".hero-vinyl__glint");
      const disc = hero.querySelector<HTMLElement>(".hero-vinyl__disc");
      const spin = disc?.getAnimations?.().find((a) => a instanceof CSSAnimation);

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        if (glow) tl.from(glow, { scale: 0.88, opacity: 0, duration: 1.4 }, 0.1);
        if (glint) tl.from(glint, { opacity: 0, duration: 1.2 }, 0.5);
        if (spin) {
          const rate = { value: 7 };
          spin.updatePlaybackRate(rate.value);
          tl.to(
            rate,
            { value: 1, duration: 2.6, onUpdate: () => spin.updatePlaybackRate(rate.value) },
            0
          );
        }
        tl.eventCallback("onComplete", () => {
          gsap.set([glow, glint].filter(Boolean), { clearProps: "transform,opacity" });
        });
      }, hero);

      return () => {
        ctx.revert();
        spin?.updatePlaybackRate(1);
      };
    });

    return () => media.revert();
  }, [heroRef]);
}
