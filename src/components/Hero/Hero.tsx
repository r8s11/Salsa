import { Link } from "react-router-dom";
import { useMemo } from "react";
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

  return (
    <section id="home" className="hero">
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
            <span className="hero-heading-line">Find your</span>
            <span className="hero-heading-line">
              <span className="hero-heading-accent">rhythm</span>
              <span className="hero-heading-dot">.</span>
            </span>
          </h1>

          <p className="hero-subtitle">
            Every salsa &amp; bachata social, pop-up class, and workshop across{" "}
            <span className="hero-subtitle-city">{cityLabel}</span> — one place, always on the
            beat.
          </p>

          <div className="hero-cta">
            <a href="#events" className="btn-primary hero-btn">
              Tonight on the floor
            </a>
            <Link to="/calendar" className="btn-secondary hero-btn">
              Full calendar
            </Link>
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
