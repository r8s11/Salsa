import ButtonLink from "../ui/ButtonLink";
import { useAuth } from "../../contexts/useAuth";
import { resolveEventCreateDestination } from "../../lib/eventCreateDestination";
import "./HomeCta.css";

function HomeCta() {
  const { isAdmin } = useAuth();
  // Same rule as the header: admins author events directly, everyone else
  // goes through the moderated submission flow.
  const submitTo = resolveEventCreateDestination(isAdmin ? "admin" : null);

  return (
    <section className="home-cta" aria-labelledby="home-cta-title">
      <div className="container home-cta__inner">
        <h2 id="home-cta-title" className="home-cta__title">
          Put your night on the record.
        </h2>
        <p className="home-cta__body">
          Hosting a social, class, or workshop? Send us the details. We review every submission, and
          once it&rsquo;s approved your night spins for dancers across Greater Boston and NYC.
        </p>
        <div className="home-cta__actions">
          <ButtonLink to={submitTo} variant="primary" className="home-cta__btn">
            Submit your event
          </ButtonLink>
          <ButtonLink to="/contact" variant="ghost" className="home-cta__aside">
            Questions first? Get in touch
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export default HomeCta;
