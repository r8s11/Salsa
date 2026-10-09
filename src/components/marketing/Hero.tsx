import "temporal-polyfill/global";
import { useLocation } from "react-router-dom";
import ButtonLink from "../ui/ButtonLink";
import IconButton from "../ui/IconButton";
import { Pause, Play } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import "./Hero.css";
import { useEvents } from "../../features/events/hooks/useEvent";
import { useCity } from "../../contexts/useCity";
import { useNewYorkToday } from "../../features/events/hooks/useNewYorkToday";
import { nightOf } from "../../features/events/model/night";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import { metroShortCode } from "../../features/metros/model/metro";
import MetroExplorer from "../../features/metros/components/MetroExplorer";
import { useHeroMotion } from "./Hero.motion";

const NEW_YORK = "America/New_York";

// "YYYY-MM-DD HH:mm" — the shape of an event's `start`, so keys compare as text.
const wallKey = (dt: Temporal.PlainDateTime) =>
  dt.toString({ smallestUnit: "minute" }).replace("T", " ");

function Hero() {
  const isMetroLanding = useLocation().pathname.startsWith("/events/");
  const { city, source } = useCity();
  const { events, loading, loadFailed } = useEvents();
  const metroName = useMetroName();
  const cityLabel = city ? metroName(city) : null;
  const cityShort = cityLabel ? metroShortCode(cityLabel) : null;
  // "Near" only when the visitor's area picked the metro; a person's own
  // choice (or the inventory fallback) is stated as "in".
  const nearby = source === "location";
  const today = useNewYorkToday();

  // Text entrance is GSAP when motion is allowed (Hero.motion.ts). CSS does
  // not hide the copy, so the first frame stays complete with JavaScript off.
  // Vinyl centring and spin stay in CSS — an inline transform would unpin the record.

  // `start` is a New York wall-clock "YYYY-MM-DD HH:mm" string, so "now" and
  // "a week out" are taken in that same frame and compared as strings — the
  // device clock's zone never decides what is upcoming. The keys are values,
  // so the memo only recomputes when the minute (or the feed) changes.
  const now = Temporal.Now.plainDateTimeISO(NEW_YORK);
  const nowKey = wallKey(now);
  const weekKey = wallKey(now.add({ days: 7 }));

  const { featuredStart, eventsThisWeek, venueCount, tickerItems, labelArt } = useMemo(() => {
    const upcoming = events
      .filter((e) => e.start >= nowKey)
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    const thisWeek = upcoming.filter((e) => e.start <= weekKey);
    const venues = new Set(upcoming.map((e) => e.location).filter(Boolean));

    // The record's paper label carries the next event, printed on two arcs so
    // it reads the way a pressed label does — and it turns with the disc.
    const featured = upcoming[0];
    const featuredTime = featured
      ? new Date(featured.start.replace(" ", "T")).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    return {
      featuredStart: featured?.start ?? null,
      eventsThisWeek: thisWeek.length,
      venueCount: venues.size,
      tickerItems: upcoming.slice(0, 8).map((e) => e.title),
      labelArt: featured
        ? {
            title: featured.title,
            meta: [featuredTime, featured.location].filter(Boolean).join(" · "),
          }
        : null,
    };
  }, [events, nowKey, weekKey]);

  // Same rule as the featured card's heading: "Tonight" only when the next
  // event is on New York's today. Until the feed has answered (loading or
  // failed) nothing is claimed, and the button names the section it opens.
  const featuredNight = featuredStart && !loadFailed ? nightOf(featuredStart, today) : null;
  const floorLabel =
    featuredNight?.kind === "tonight"
      ? "Tonight on the floor"
      : featuredNight?.kind === "today"
        ? "Today on the floor"
        : featuredNight?.kind === "later"
          ? `Next up · ${featuredNight.label}`
          : "This week's floor";

  // A failed load has no counts to report; a dash says "unknown" where a 0
  // would claim the floor is empty. It holds through a retry so the stats
  // don't blink out and back.
  const heroStats = cityShort
    ? [
        { num: loadFailed ? null : eventsThisWeek, label: "Events This Week" },
        { num: loadFailed ? null : venueCount, label: venueCount === 1 ? "Venue" : "Venues" },
        { num: cityShort, label: "On The Floor" },
      ]
    : [];

  const [tickerPaused, setTickerPaused] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  useHeroMotion(heroRef, `${isMetroLanding ? "metro" : "home"}:${cityLabel ?? ""}`);

  // Pointer response: the backdrop drifts a few px and the light on the record
  // follows the cursor. Mouse only, motion allowed — touch, pen, keyboard and
  // reduced-motion all keep the static, fully composed frame. Writes are
  // coalesced to one per frame so a fast mouse never queues style work.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    );

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hero.style.setProperty("--hero-parallax-x", "0px");
      hero.style.setProperty("--hero-parallax-y", "0px");
      hero.style.removeProperty("--hero-light-x");
      hero.style.removeProperty("--hero-light-y");
    };

    const paint = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((pointerX - rect.left) / rect.width - 0.5) * 2;
      const y = ((pointerY - rect.top) / rect.height - 0.5) * 2;
      hero.style.setProperty("--hero-parallax-x", `${x * 6}px`);
      hero.style.setProperty("--hero-parallax-y", `${y * 6}px`);
      hero.style.setProperty("--hero-light-x", x.toFixed(3));
      hero.style.setProperty("--hero-light-y", y.toFixed(3));
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onVisibility = () => {
      if (document.hidden) reset();
    };

    const disarm = () => {
      hero.removeEventListener("pointermove", handleMove);
      hero.removeEventListener("pointerleave", reset);
      hero.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibility);
      reset();
    };

    const arm = () => {
      hero.addEventListener("pointermove", handleMove, { passive: true });
      hero.addEventListener("pointerleave", reset);
      hero.addEventListener("pointercancel", reset);
      window.addEventListener("blur", reset);
      document.addEventListener("visibilitychange", onVisibility);
    };

    const sync = () => {
      disarm();
      if (mq.matches) arm();
    };

    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      disarm();
    };
  }, []);

  // Park the ambient animations while the hero is off-screen: the glow
  // pulse, grid drift, marquee and disc spin run forever by design, but
  // there is no reason to composite them behind the fold.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => hero.classList.toggle("hero--idle", !entry.isIntersecting),
      { rootMargin: "80px" }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="home" className="hero" ref={heroRef}>
      {/* Atmospheric background */}
      <div className="hero-bg hero-enter" data-enter="bg" aria-hidden="true">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="hero-vinyl hero-enter" data-enter="vinyl" aria-hidden="true">
          <div className="hero-vinyl__glow" />
          <div className="hero-vinyl__disc">
            <div className="hero-vinyl__grooves" />
            <div className="hero-vinyl__label" />
            {labelArt && (
              <svg className="hero-vinyl__print" viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <path
                    id="hero-vinyl-arc-title"
                    d="M 36.32,87.59 A 40,40 0 0 1 36.32,12.41"
                    fill="none"
                  />
                  <path
                    id="hero-vinyl-arc-meta"
                    d="M 32.79,74.57 A 30,30 0 0 1 32.79,25.43"
                    fill="none"
                  />
                </defs>
                <text className="hero-vinyl__print-title">
                  <textPath href="#hero-vinyl-arc-title" startOffset="50%" textAnchor="middle">
                    {labelArt.title}
                  </textPath>
                </text>
                {labelArt.meta && (
                  <text className="hero-vinyl__print-meta">
                    <textPath href="#hero-vinyl-arc-meta" startOffset="50%" textAnchor="middle">
                      {labelArt.meta}
                    </textPath>
                  </text>
                )}
              </svg>
            )}
          </div>
          <div className="hero-vinyl__sheen" />
          <div className="hero-vinyl__glint" />
        </div>
      </div>

      <div className="container">
        <div className="hero-content">
          <div className="hero-eyebrow hero-enter" data-enter="eyebrow">
            <span className="hero-eyebrow-line" aria-hidden="true" />
            <span>
              {cityLabel
                ? `Salsa & Bachata Events ${nearby ? "near" : "in"} ${cityLabel}`
                : "Salsa & Bachata Events"}
            </span>
          </div>

          <h1 className="hero-heading hero-enter" data-enter="heading" data-split-words>
            <span className="hero-split-source">
              {cityLabel && isMetroLanding ? (
                <>
                  <span className="hero-heading-line" data-line="1">
                    Salsa &amp; Bachata
                  </span>{" "}
                  <span className="hero-heading-line" data-line="2">
                    <span className="hero-heading-accent">in {cityLabel}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="hero-heading-line" data-line="1">
                    Find Your
                  </span>
                  <span className="hero-heading-line" data-line="2">
                    <span className="hero-heading-accent">Rhythm</span>
                    <span className="hero-heading-dot">.</span>
                  </span>
                </>
              )}
            </span>
            <span className="hero-split-live" aria-hidden="true">
              {cityLabel && isMetroLanding ? (
                <>
                  <span className="hero-heading-line" data-line="1">
                    {["Salsa", "&", "Bachata"].map((word) => (
                      <span className="hero-split-word" key={word}>
                        {word}{" "}
                      </span>
                    ))}
                  </span>
                  <span className="hero-heading-line" data-line="2">
                    {["in", ...cityLabel.split(/\s+/).filter(Boolean)].map((word) => (
                      <span className="hero-split-word hero-heading-accent" key={word}>
                        {word}{" "}
                      </span>
                    ))}
                  </span>
                </>
              ) : (
                <>
                  <span className="hero-heading-line" data-line="1">
                    <span className="hero-split-word">Find</span>{" "}
                    <span className="hero-split-word">Your</span>
                  </span>
                  <span className="hero-heading-line" data-line="2">
                    <span className="hero-split-word hero-heading-accent">Rhythm</span>
                    <span className="hero-split-word hero-heading-dot">.</span>
                  </span>
                </>
              )}
            </span>
          </h1>

          <p className="hero-subtitle hero-enter" data-enter="subtitle">
            {cityLabel ? (
              <>
                <span className="hero-subtitle-full">
                  Discover socials, parties, classes, and dance events happening{" "}
                  {nearby ? (
                    "near you"
                  ) : (
                    <>
                      in <span className="hero-subtitle-city">{cityLabel}</span>
                    </>
                  )}
                  .
                </span>
                <span className="hero-subtitle-short">
                  Salsa &amp; bachata socials, classes, workshops.
                </span>
              </>
            ) : (
              "We're growing city by city. Explore events in other cities or submit one near you."
            )}
          </p>

          <div className="hero-metro hero-enter" data-enter="subtitle">
            <MetroExplorer label="Explore other cities" />
          </div>

          <div className="hero-cta hero-enter" data-enter="cta">
            <a href="#events" className="ui-button ui-button--primary hero-btn hero-btn--primary">
              {floorLabel}
            </a>
            <ButtonLink to="/calendar" variant="secondary" className="hero-btn hero-btn--secondary">
              Full calendar
            </ButtonLink>
          </div>

          {heroStats.length > 0 && (!loading || loadFailed) && (
            <div className="hero-stats hero-stats--compact hero-enter" data-enter="stats">
              {heroStats.map((stat) => (
                <div
                  className="hero-stat"
                  key={stat.label}
                  role={stat.num === null ? "group" : undefined}
                  aria-label={stat.num === null ? `${stat.label}: not available` : undefined}
                >
                  <div
                    className={`hero-stat-num${stat.num === null ? " hero-stat-num--unavailable" : ""}`}
                    aria-hidden={stat.num === null || undefined}
                  >
                    {stat.num ?? "—"}
                  </div>
                  <div className="hero-stat-label" aria-hidden={stat.num === null || undefined}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tickerItems.length > 0 && (
        <div className="hero-ticker">
          <div
            className={`hero-ticker-track${tickerPaused ? " is-paused" : ""}`}
            aria-hidden="true"
          >
            {[...tickerItems, ...tickerItems].map((title, i) => (
              <span className="hero-ticker-item" key={i}>
                {title}
                <span className="hero-ticker-dot">◆</span>
              </span>
            ))}
          </div>
          <IconButton
            className="hero-ticker-control"
            variant="outline"
            aria-label={tickerPaused ? "Resume event ticker" : "Pause event ticker"}
            aria-pressed={tickerPaused}
            onClick={() => setTickerPaused((paused) => !paused)}
          >
            {tickerPaused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
          </IconButton>
        </div>
      )}
    </section>
  );
}

export default Hero;
