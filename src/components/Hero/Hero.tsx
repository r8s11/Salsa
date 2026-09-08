import ButtonLink from "../ui/ButtonLink";
import { useMemo, useEffect, useRef } from "react";
import "./Hero.css";
import { useEvents } from "../../hooks/useEvent";
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

  const { eventsThisWeek, venueCount, tickerItems } = useMemo(() => {
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

    return {
      eventsThisWeek: thisWeek.length,
      venueCount: venues.size,
      tickerItems: upcoming.slice(0, 8).map((e) => e.title),
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
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-glow" />
        <div className="hero-grid" />
      </div>

      <div className="container">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line" aria-hidden="true" />
            <span>{cityLabel} · Live Dance Guide</span>
          </div>

          <h1 className="hero-heading">
            <span className="hero-heading-line" data-line="1">Find Your</span>
            <span className="hero-heading-line" data-line="2">
              <span className="hero-heading-accent">Rhythm</span>
              <span className="hero-heading-dot">.</span>
            </span>
          </h1>

          <p className="hero-subtitle">
            Every salsa &amp; bachata social, pop-up class, and workshop across{" "}
            <span className="hero-subtitle-city">{cityLabel}</span> — one place, always on the beat.
          </p>

          <div className="hero-cta">
            <a href="#events" className="ui-button ui-button--primary hero-btn">
              Tonight on the floor
            </a>
            <ButtonLink to="/calendar" variant="secondary" className="hero-btn">
              Full calendar
            </ButtonLink>
          </div>

          {!loading && (
            <div className="hero-stats">
              {heroStats.map((stat) => (
                <div className="hero-stat" key={stat.label}>
                  <div className="hero-stat-num">{stat.num}</div>
                  <div className="hero-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
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