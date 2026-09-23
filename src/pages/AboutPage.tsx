import { useRef, type PointerEvent } from "react";
import ButtonLink from "../components/ui/ButtonLink";
import { useAboutMotion } from "./AboutPage.motion";
import "./AboutPage.css";

const PILLARS = [
  {
    title: "One calendar",
    body: "A single source for salsa, bachata, and Latin dance events across Greater Boston and NYC.",
  },
  {
    title: "Pop-ups & workshops",
    body: "Short-run classes and workshops surfaced alongside the regular socials — easy to catch, easy to miss otherwise.",
  },
  {
    title: "Instructor directory",
    body: "Find your next teacher without asking around the floor.",
  },
  {
    title: "Community-submitted",
    body: "Organizers and dancers add events directly, so the calendar stays current instead of stale.",
  },
];

function AboutPage() {
  const rootRef = useRef<HTMLDivElement>(null);
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
            Our Story
          </p>
          <h1 data-split-words>
            <span className="about-split-source">Every record needs a place to spin.</span>
          </h1>
          <p className="about-hero__intro" data-reveal>
            Welcome to Salsa Segura — a community of dancers inviting everyone into the joy of Latin
            dance. A place for dancers of all levels to learn, grow, and connect, whether you're in
            Greater Boston or New York City.
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
            <span className="about-split-source">The Story</span>
          </h2>
          <p data-reveal>
            Born from a love of Salsa and Bachata, Salsa Segura is a gathering place for dancers
            finding their rhythm in the social dance community. What began as a simple idea to
            connect dancers across Boston has grown into a hub for Latin dance enthusiasts across
            Greater Boston and New York City.
          </p>
        </div>
      </section>

      {/* ── Chapter: What You'll Find ── */}
      <section className="about-chapter about-chapter--offerings" data-chapter="offerings">
        <div className="container about-chapter__inner">
          <h2 data-split-words>
            <span className="about-split-source">What You'll Find</span>
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
            <span className="about-split-source">A Place for Everyone</span>
          </h2>
          <p data-reveal>
            Whether you are taking your first steps or have been dancing for years, Salsa Segura
            welcomes you. The community connects dancers with events, instructors, and each other
            across Greater Boston, New York City, and beyond.
          </p>
          <div data-reveal>
            <ButtonLink to="/calendar" variant="primary" className="about-cta__btn">
              Browse the Calendar
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
