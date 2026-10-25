import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Splits a `[data-split-words]` heading into per-word spans for a GSAP
 * stagger reveal, while keeping the accessible name intact.
 *
 * The heading renders plain text by default (`.about-split-source`), so a
 * visitor without JavaScript sees the real, unsplit sentence. On mount this
 * swaps that text node for word spans wrapped in an `aria-hidden` container,
 * and carries the original sentence forward as the heading's `aria-label` —
 * screen readers get one clean name, never the decorative per-word markup.
 */
function splitIntoWords(heading: HTMLElement): () => void {
  const source = heading.querySelector<HTMLElement>(".about-split-source");
  if (!source) return () => {};

  const text = source.textContent ?? "";
  heading.setAttribute("aria-label", text);

  const wrapper = document.createElement("span");
  wrapper.className = "about-split-wrapper";
  wrapper.setAttribute("aria-hidden", "true");

  const words = text.split(" ");
  words.forEach((word, i) => {
    const wordSpan = document.createElement("span");
    wordSpan.className = "about-split-word";
    wordSpan.textContent = word;
    wrapper.appendChild(wordSpan);
    if (i < words.length - 1) wrapper.appendChild(document.createTextNode(" "));
  });

  source.replaceWith(wrapper);
  return () => {
    if (wrapper.parentNode) wrapper.replaceWith(source);
    heading.removeAttribute("aria-label");
  };
}

/**
 * Page-scoped motion system for /about: one GSAP timeline set + one Lenis
 * instance, both created and torn down with this component. Nothing here
 * touches global scroll, other routes, or the rest of the app's (CSS-only)
 * animation system.
 */
export function useAboutMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const headings = Array.from(root.querySelectorAll<HTMLElement>("[data-split-words]"));
    const revertSplits = headings.map(splitIntoWords);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // Reduced motion renders every final state immediately — no Lenis,
      // no scrubbed timeline, no entrance animation to skip past.
      gsap.set(root.querySelectorAll(".about-split-word, [data-reveal]"), {
        opacity: 1,
        clearProps: "transform",
      });
      gsap.set(".about-progress__fill", { scaleY: 1 });
      return () => revertSplits.forEach((revert) => revert());
    }

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    const ctx = gsap.context(() => {
      const heroWords = root.querySelectorAll(".about-hero .about-split-word");
      gsap.from(heroWords, {
        opacity: 0,
        yPercent: 115,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.035,
        delay: 0.1,
      });
      gsap.from(root.querySelectorAll(".about-hero [data-reveal]"), {
        opacity: 0,
        y: 18,
        duration: 0.7,
        ease: "power2.out",
        delay: 0.45,
      });

      root.querySelectorAll<HTMLElement>("[data-chapter]").forEach((chapter) => {
        const words = chapter.querySelectorAll(".about-split-word");
        if (words.length) {
          gsap.from(words, {
            opacity: 0,
            yPercent: 100,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.03,
            scrollTrigger: { trigger: chapter, start: "top 78%" },
          });
        }
        const revealBody = chapter.querySelectorAll("[data-reveal]");
        if (revealBody.length) {
          gsap.from(revealBody, {
            opacity: 0,
            y: 22,
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.08,
            scrollTrigger: { trigger: chapter, start: "top 72%" },
          });
        }
      });

      // The one scrubbed timeline: a progress rail that fills alongside the
      // story chapter, tying scroll position to a visible marker instead of
      // decorating the page with motion that reports nothing.
      const storyChapter = root.querySelector('[data-chapter="story"]');
      const rail = root.querySelector(".about-progress__fill");
      if (storyChapter && rail) {
        gsap.fromTo(
          rail,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: storyChapter,
              start: "top 65%",
              end: "bottom 45%",
              scrub: true,
            },
          }
        );
      }

      const pillars = root.querySelectorAll(".about-pillars__item");
      if (pillars.length) {
        gsap.from(pillars, {
          opacity: 0,
          y: 26,
          duration: 0.55,
          ease: "power2.out",
          stagger: 0.09,
          scrollTrigger: { trigger: ".about-pillars", start: "top 78%" },
        });
      }
    }, root);

    return () => {
      ctx.revert();
      gsap.ticker.remove(onTick);
      lenis.destroy();
      revertSplits.forEach((revert) => revert());
    };
  }, [rootRef]);
}
