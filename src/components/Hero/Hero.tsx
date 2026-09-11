import ButtonLink from "../ui/ButtonLink";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useEffect, useRef } from "react";
import "./Hero.css";
import { useEvents } from "../../features/events/hooks/useEvent";
import { useCity } from "../../contexts/useCity";

const CITY_LABELS: Record<string, string> = {
  boston: "Greater Boston",
  "new-york-city": "NYC",
};

const CITY_SHORT: Record<string, string> = {
  boston: "BOS",
  "new-york-city": "NYC",
};

function Hero() {
  const { city } = useCity();
  const { events, loading } = useEvents();
  const cityLabel = CITY_LABELS[city] ?? city;
  const cityShort = CITY_SHORT[city] ?? city;

  const shouldReduceMotion = useReducedMotion();
  const enter = (delay: number, y = 18) =>
    shouldReduceMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  // Opacity only: the record's centring transform lives in CSS
  // (.hero-vinyl pins its spindle to the section's right edge), and an
  // inline Motion transform would overwrite it. The disc spins in CSS too,
  // so the static sheen and outer glow stay put while the record turns.
  const vinylMotion = shouldReduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] as const },
      };


  const { eventsThisWeek, venueCount, tickerItems, labelArt } = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(now.getDate() + 7);

    const upcoming = events
      .filter((e) => new Date(e.start.replace(" ", "T")) >= now)
      .sort(
        (a, b) =>
          new Date(a.start.replace(" ", "T")).getTime() -
          new Date(b.start.replace(" ", "T")).getTime()
      );

    const thisWeek = upcoming.filter((e) => new Date(e.start.replace(" ", "T")) <= weekFromNow);
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
  }, [events]);

  const heroStats = [
    { num: eventsThisWeek, label: "Events This Week" },
    { num: venueCount, label: "Venues" },
    { num: cityShort, label: "On The Floor" },
  ];

  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;

    const handleMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      hero.style.setProperty("--hero-parallax-x", `${x * 6}px`);
      hero.style.setProperty("--hero-parallax-y", `${y * 6}px`);
    };

    const handleLeave = () => {
      hero.style.setProperty("--hero-parallax-x", "0px");
      hero.style.setProperty("--hero-parallax-y", "0px");
    };

    hero.addEventListener("mousemove", handleMove);
    hero.addEventListener("mouseleave", handleLeave);
    return () => {
      hero.removeEventListener("mousemove", handleMove);
      hero.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <section id="home" className="hero" ref={heroRef}>
      {/* Atmospheric background */}
      <motion.div className="hero-bg" aria-hidden="true" {...enter(0, 0)}>
        <div className="hero-glow" />
        <div className="hero-grid" />
        <motion.div className="hero-vinyl" aria-hidden="true" {...vinylMotion}>
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
        </motion.div>
      </motion.div>

      <div className="container">
        <div className="hero-content">
          <motion.div className="hero-eyebrow" {...enter(0.12, 10)}>
            <span className="hero-eyebrow-line" aria-hidden="true" />
            <span>{cityLabel} · Live Dance Guide</span>
          </motion.div>

          <motion.h1 className="hero-heading" {...enter(0.22)}>
            <span className="hero-heading-line" data-line="1">Find Your</span>
            <span className="hero-heading-line" data-line="2">
              <span className="hero-heading-accent">Rhythm</span>
              <span className="hero-heading-dot">.</span>
            </span>
          </motion.h1>

          <motion.p className="hero-subtitle" {...enter(0.36, 14)}>
            Every salsa &amp; bachata social, pop-up class, and workshop across{" "}
            <span className="hero-subtitle-city">{cityLabel}</span> — one place, always on the beat.
          </motion.p>

          <motion.div className="hero-cta" {...enter(0.48, 14)}>
            <a href="#events" className="ui-button ui-button--primary hero-btn hero-btn--primary">
              Tonight on the floor
            </a>
            <ButtonLink to="/calendar" variant="secondary" className="hero-btn hero-btn--secondary">
              Full calendar
            </ButtonLink>
          </motion.div>

          {!loading && (
            <motion.div className="hero-stats hero-stats--compact" {...enter(0.58, 12)}>
              {heroStats.map((stat) => (
                <div className="hero-stat" key={stat.label}>
                  <div className="hero-stat-num">{stat.num}</div>
                  <div className="hero-stat-label">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {tickerItems.length > 0 && (
        <div className="hero-ticker" aria-hidden="true">
          <div className="hero-ticker-track">
            {[...tickerItems, ...tickerItems].map((title, i) => (
              <span className="hero-ticker-item" key={i}>
                {title}
                <span className="hero-ticker-dot">◆</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Hero;