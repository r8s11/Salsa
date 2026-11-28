import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";
import ButtonLink from "../components/ui/ButtonLink";
import { useActiveMetros } from "../features/metros/hooks/useMetros";
import worldDots from "../assets/about/world-dots.svg";
import { useAboutMotion } from "./AboutPage.motion";
import "./AboutPage.css";

// The dot map (src/assets/about/world-dots.svg) is equirectangular, 84°N to 58°S.
const MAP_TOP = 84;
const MAP_SPAN = 142;
const ORIGIN = { lat: 42.36, lon: -71.06 }; // Boston, where Salsa Segura started.
const MARKER = { lat: 22, lon: -30 }; // The disc sits in the open Atlantic, clear of the lit cities.

function mapPoint(lat: number, lon: number): CSSProperties {
  return {
    left: `${((lon + 180) / 360) * 100}%`,
    top: `${((MAP_TOP - lat) / MAP_SPAN) * 100}%`,
  };
}

const REVIEW_STEPS = [
  {
    title: "Submitted",
    body: "A dancer, organizer, or school sends in a night with its date, venue, and details.",
  },
  {
    title: "Reviewed",
    body: "A moderator reviews the submission before it goes public.",
  },
  {
    title: "On the calendar",
    body: "Approved nights appear on the calendar for their city.",
  },
];

const DIRECTORY = [
  {
    to: "/calendar",
    title: "Calendar",
    body: "Socials, classes, workshops, and live music, week by week.",
  },
  { to: "/schools", title: "Schools", body: "Where to learn, with weekly class timetables." },
  { to: "/instructors", title: "Instructors", body: "Local teachers and the classes they run." },
  { to: "/djs", title: "DJs", body: "Who is playing, and where they have residencies." },
  { to: "/venues", title: "Venues", body: "The rooms where the dancing happens." },
];

function upcomingLabel(count: number) {
  return `${count} ${count === 1 ? "night" : "nights"}`;
}

function NightMap() {
  const { activeMetros, loading, loadFailed } = useActiveMetros();
  const [lit, setLit] = useState<string | null>(null);
  const plotted = activeMetros.filter(
    (metro) => metro.latitude !== null && metro.longitude !== null
  );

  return (
    <figure className="about-map" aria-labelledby="about-map-caption">
      <div className="about-map__viewport">
        <div className="about-map__plate">
          <img className="about-map__dots" src={worldDots} alt="" aria-hidden="true" />
          {plotted.map((metro, index) => (
            <span
              key={metro.slug}
              className="about-map__glow"
              data-lit={lit === metro.slug || undefined}
              style={
                {
                  ...mapPoint(metro.latitude!, metro.longitude!),
                  "--about-glow-delay": `${0.6 + index * 0.25}s`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          ))}
          <svg
            className="about-map__leader"
            viewBox="0 0 360 142"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1={ORIGIN.lon + 180}
              y1={MAP_TOP - ORIGIN.lat}
              x2={MARKER.lon + 180}
              y2={MAP_TOP - MARKER.lat}
            />
          </svg>
          <span
            className="about-map__origin"
            style={mapPoint(ORIGIN.lat, ORIGIN.lon)}
            aria-hidden="true"
          />
          <div
            className="about-map__marker"
            style={mapPoint(MARKER.lat, MARKER.lon)}
            aria-hidden="true"
          >
            <div className="about-hero__disc">
              <span className="about-hero__disc-glow" />
              <span className="about-hero__disc-face" />
              <span className="about-hero__disc-grooves" />
              <span className="about-hero__disc-label" />
            </div>
            <span className="about-map__marker-label">Where it started</span>
          </div>
        </div>
      </div>

      <figcaption id="about-map-caption" className="about-map__caption">
        {loading ? (
          <p className="about-map__status">Loading this week's nights…</p>
        ) : loadFailed ? (
          <p className="about-map__status">
            This week's city counts didn't load. <Link to="/calendar">See the calendar</Link>
          </p>
        ) : activeMetros.length === 0 ? (
          <p className="about-map__status">
            No upcoming nights are listed right now. <Link to="/submit">List yours</Link>
          </p>
        ) : (
          <ul
            className="about-ledger"
            data-columns={activeMetros.length > 4 ? 2 : undefined}
            aria-label="Cities with upcoming nights"
          >
            {activeMetros.map((metro) => (
              <li key={metro.slug}>
                <Link
                  className="about-ledger__row"
                  to={`/events/${metro.slug}`}
                  onPointerEnter={() => setLit(metro.slug)}
                  onPointerLeave={() => setLit(null)}
                  onFocus={() => setLit(metro.slug)}
                  onBlur={() => setLit(null)}
                >
                  <span className="about-ledger__dot" aria-hidden="true" />
                  <span className="about-ledger__city">{metro.name}</span>
                  <span className="about-ledger__count">
                    {upcomingLabel(metro.upcomingEventCount)}
                  </span>
                  <ArrowUpRight className="about-ledger__arrow" size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}

function AboutPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useDocumentMeta({ ...routeMeta.about, canonical: canonicalUrl(routeMeta.about.path) });

  useAboutMotion(rootRef);

  // Pointer parallax on the disc — additive only. CSS gates the transform to
  // fine pointers with motion allowed, so touch/keyboard/reduced-motion
  // visitors just see the disc flat; skip the per-move style writes for
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
      {/* ── Hero: the night map ── */}
      <section
        className="about-hero"
        aria-labelledby="about-title"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
      >
        <div className="about-hero__grid">
          <div className="about-hero__content">
            <h1 id="about-title" data-split-words>
              <span className="about-split-source">
                Started in Boston. Then New York. Next, wherever you land.
              </span>
            </h1>
            <p className="about-hero__intro" data-reveal>
              Salsa Segura works for the dance community: the dancers looking for a floor and the
              people who run the socials, classes, and live music that make one. Submissions are
              reviewed by a person before they go live.
            </p>
            <div className="about-hero__actions" data-reveal>
              <ButtonLink to="/calendar" variant="primary">
                Browse events
              </ButtonLink>
              <ButtonLink to="/submit" variant="ghost">
                List your night
              </ButtonLink>
            </div>
          </div>
          <div className="about-hero__map" data-reveal>
            <NightMap />
          </div>
        </div>
      </section>

      <div className="about-progress" aria-hidden="true">
        <span className="about-progress__track" />
        <span className="about-progress__fill" />
      </div>

      {/* ── Chapter: the story ── */}
      <section
        className="about-chapter about-chapter--story"
        data-chapter="story"
        aria-labelledby="about-story"
      >
        <div className="container about-chapter__inner">
          <h2 id="about-story" data-split-words>
            <span className="about-split-source">One city's dance floors, then the next.</span>
          </h2>
          <p data-reveal>
            Salsa Segura started in Boston with a simple idea: help dancers find each other. New
            York City came next.
          </p>
          <p data-reveal>
            The goal is bigger than two cities. Wherever you land, in any city or any country, open
            Salsa Segura and find somewhere to dance tonight.
          </p>
          <p data-reveal>
            We answer to the community: to dancers, and to everyone who keeps a social running.
            Whatever helps the scene grow is the work.
          </p>
        </div>
      </section>

      {/* ── Chapter: how a night gets listed ── */}
      <section
        className="about-chapter about-chapter--review"
        data-chapter="review"
        aria-labelledby="about-review"
      >
        <div className="about-wide about-chapter__inner">
          <h2 id="about-review" data-split-words>
            <span className="about-split-source">
              Submissions are reviewed before they go live.
            </span>
          </h2>
          <ol className="about-route">
            {REVIEW_STEPS.map((step) => (
              <li className="about-route__stop" key={step.title} data-reveal>
                <span className="about-route__pin" aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Chapter: what you'll find ── */}
      <section
        className="about-chapter about-chapter--find"
        data-chapter="find"
        aria-labelledby="about-find"
      >
        <div className="container about-chapter__inner">
          <h2 id="about-find" data-split-words>
            <span className="about-split-source">What you'll find</span>
          </h2>
          <ul className="about-index">
            {DIRECTORY.map((item) => (
              <li key={item.to} data-reveal>
                <Link className="about-index__row" to={item.to}>
                  <span className="about-index__title">{item.title}</span>
                  <span className="about-index__body">{item.body}</span>
                  <ArrowUpRight className="about-index__arrow" size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Close: two ways in ── */}
      <section
        className="about-chapter about-chapter--close"
        data-chapter="close"
        aria-labelledby="about-close"
      >
        <div className="about-wide about-close">
          <div className="about-close__path">
            <h2 id="about-close" data-split-words>
              <span className="about-split-source">Here to dance?</span>
            </h2>
            <p data-reveal>
              New to dancing or already on the floor, you're welcome. Find a social, a class, or a
              band this week.
            </p>
            <div data-reveal>
              <ButtonLink to="/calendar" variant="primary">
                Browse events
              </ButtonLink>
            </div>
          </div>
          <div className="about-close__path">
            <h2 data-split-words>
              <span className="about-split-source">Run a night or a school?</span>
            </h2>
            <p data-reveal>
              We're here to help your night grow. Put it on the map, or claim your school, venue, or
              DJ listing and keep it current.
            </p>
            <div className="about-close__actions" data-reveal>
              <ButtonLink to="/submit" variant="secondary">
                Submit an event
              </ButtonLink>
              <ButtonLink to="/request-listing" variant="ghost">
                Request a listing
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
