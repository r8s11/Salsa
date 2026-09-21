import ButtonLink from "../ui/ButtonLink";
import "./HomeCta.css";

function HomeCta() {
  return (
    <section className="home-cta">
      <div className="container home-cta__inner">
        <h2 className="home-cta__title">Ready to Dance?</h2>
        <p className="home-cta__body">
          Booking a lesson, hosting an event, or just saying hello — we read every message.
        </p>
        <ButtonLink to="/contact" variant="primary" className="home-cta__btn">
          Get in Touch
        </ButtonLink>
      </div>
    </section>
  );
}

export default HomeCta;
