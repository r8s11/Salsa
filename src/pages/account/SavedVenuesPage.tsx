import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import SaveVenueButton from "../../components/Venue/SaveVenueButton";
import { useSavedVenues } from "../../features/venues/hooks/useSavedVenues";
import "./SavedVenuesPage.css";

export default function SavedVenuesPage() {
  const { savedVenues, isLoading, isError, error, refetch } = useSavedVenues();

  return (
    <div className="saved-venues-page container">
      <header className="saved-venues-page__header">
        <h1>Saved Venues</h1>
        <p>Places you’ve saved for later.</p>
      </header>

      {isError && (
        <section className="saved-venues-page__error" role="alert">
          <p>We couldn’t load your saved venues.</p>
          <p className="saved-venues-page__error-detail">{error}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try Again
          </Button>
        </section>
      )}

      {!isError && isLoading && (
        <div className="saved-venues-grid" aria-busy="true" aria-label="Loading saved venues">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="saved-venues-card saved-venues-card--skeleton" key={index} />
          ))}
        </div>
      )}

      {!isError && !isLoading && savedVenues.length === 0 && (
        <section className="saved-venues-page__empty">
          <h2>No saved venues yet</h2>
          <p>Save venues you want to remember and they’ll appear here.</p>
          <ButtonLink to="/calendar" variant="primary">
            Explore Venues
          </ButtonLink>
        </section>
      )}

      {!isError && !isLoading && savedVenues.length > 0 && (
        <div className="saved-venues-grid">
          {savedVenues.map((venue) => (
            <article className="saved-venues-card" key={venue.venue_id}>
              <div className="saved-venues-card__body">
                <h2 className="saved-venues-card__name">
                  <Link to={`/venues/${venue.slug ?? venue.venue_id}`}>{venue.name}</Link>
                </h2>
                {venue.city && <p className="saved-venues-card__city">{venue.city}</p>}
              </div>
              <div className="saved-venues-card__actions">
                <SaveVenueButton venueId={venue.venue_id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
