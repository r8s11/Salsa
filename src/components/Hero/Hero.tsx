import { Link } from "react-router-dom";
import "./Hero.css";

function Hero() {
  return (
    <section id="home" className="hero">
      {/* Atmospheric background */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-glow" />
        <div className="hero-grid" />
      </div>

      <div className="container">
        <div className="hero-content">
          <p className="hero-eyebrow">Boston · MA</p>

          <h1>
            Dance with<br />
            <em>Passion.</em>
          </h1>

          <div className="hero-rule" aria-hidden="true">
            <span className="hero-rule-line" />
            <span className="hero-rule-diamond">◆</span>
            <span className="hero-rule-line" />
          </div>

          <p className="hero-subtitle">
            Salsa &nbsp;·&nbsp; Bachata &nbsp;·&nbsp; Pop-up Classes &nbsp;·&nbsp; Social Dance Events
          </p>

          <div className="hero-cta">
            <a href="#events" className="hero-btn hero-btn--primary">Explore Events</a>
            <Link to="/calendar" className="hero-btn hero-btn--outline">View Calendar</Link>
          </div>
        </div>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <div className="hero-scroll-line" />
        <span>Scroll</span>
      </div>
    </section>
  );
}

export default Hero;
