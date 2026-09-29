import { useRef, type PointerEvent } from "react";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import ButtonLink from "../components/ui/ButtonLink";
import { useAboutMotion } from "./AboutPage.motion";
import "./AboutPage.css";

const PILLARS = [
  {
    title: "One calendar",
    body: "Browse salsa, bachata, and Latin dance events across Greater Boston and NYC on one calendar.",
  },
  {
    title: "Pop-ups and workshops",
    body: "Find short-run classes and workshops alongside the regular socials, all in one calendar.",
  },
  {
    title: "Instructor directory",
    body: "Browse local instructors instead of relying on word of mouth.",
  },
  {
    title: "Community listings",
    body: "Organizers and dancers can submit events directly. Each listing is reviewed before it appears.",
  },
];

function AboutPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useDocumentMeta({
    title: "About Salsa Segura",
    description: "Learn how Salsa Segura helps dancers find salsa, bachata, and Latin dance events across Greater Boston and New York City.",
    canonical: canonicalUrl("/about"),
  });

  useAboutMotion(rootRef);

  // Pointer parallax on the disc — additive only. CSS gates the transform to
  // fine pointers with motion allowed, so touch/keyboard/reduced-motion
  // visitors just see the disc centered; skip the per-move style writes for
  // them too. Nothing here is required for the hero to be complete.
  function handlePointerMove(e: PointerEvent<HTMLElement>) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - bounds.left) / bounds.width - 0.5;
    const y = (e.clientY - bounds.top) / bounds.height - 0.5;
    e.currentTarget.style.setProperty("--about-tilt-x", `${(x * 10).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--about-tilt-y", `${(y * -10).toFixed(2)}deg`);
  }

  function resetTilt(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty("--about-tilt-x", "0deg");
    e.currentTarget.style.setProperty("--about-tilt-y", "0deg");
  }

  return (
    <div className="about-cinematic" ref={rootRef}>
      {/* ── Hero ── */}
      <section className="about-hero" onPointerMove={handlePointerMove} onPointerLeave={resetTilt}>
        <div className="about-hero__disc" aria-hidden="true">
          <span className="about-hero__disc-glow" />
          <span className="about-hero__disc-face" />
          <span className="about-hero__disc-grooves" />
          <span className="about-hero__disc-label" />
        </div>

        <div className="container about-hero__content">
          <p className="about-hero__eyebrow" data-reveal>
            Our story
          </p>
          <h1 data-split-words>
            <span className="about-split-source">Find a dance this week.</span>
          </h1>
          <p className="about-hero__intro" data-reveal>
            Salsa Segura is a community for dancers at every level. Find events and instructors across
            Greater Boston and New York City, and connect with the local Latin dance scene.
          </p>
        </div>
      </section>

      <div className="about-progress" aria-hidden="true">
        <span className="about-progress__track" />
        <span className="about-progress__fill" />
      </div>

      {/* ── Chapter: The Story ── */}
      <section className="about-chapter about-chapter--story" data-chapter="story">
        <div className="container about-chapter__inner">
          <h2 data-split-words>
            <span className="about-split-source">How it started</span>
          </h2>
          <p data-reveal>
            Salsa Segura started with a love of salsa and bachata and a simple idea: help Boston
            dancers find each other. The calendar now lists events across Greater Boston and New York
            City.
          </p>
        </div>
      </section>

      {/* ── Chapter: What You'll Find ── */}
      <section className="about-chapter about-chapter--offerings" data-chapter="offerings">
        <div className="container about-chapter__inner">
          <h2 data-split-words>
            <span className="about-split-source">What you'll find</span>
          </h2>
          <ul className="about-pillars">
            {PILLARS.map((pillar) => (
              <li className="about-pillars__item" key={pillar.title}>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Chapter: A Place for Everyone ── */}
      <section className="about-chapter about-chapter--everyone" data-chapter="everyone">
        <div className="container about-chapter__inner about-chapter__inner--centered">
          <h2 data-split-words>
            <span className="about-split-source">For every dancer</span>
          </h2>
          <p data-reveal>
            New to dancing or already on the floor, you're welcome here. Find events and instructors
            across Greater Boston, New York City, and beyond, and connect with other dancers.
          </p>
          <div data-reveal>
            <ButtonLink to="/calendar" variant="primary" className="about-cta__btn">
              Browse events
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
