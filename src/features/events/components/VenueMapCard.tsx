import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import "./VenueMapCard.css";

interface VenueMapCardProps {
  /** Canonical venue name (`events.location`). */
  venueName: string | null;
  /** Canonical street address (`events.address`). */
  streetAddress: string | null;
  /** Display label for `events.city`, e.g. "New York City". */
  cityLabel: string | null;
  /** Maps deep link from `mapsUrl()`; hidden when the event has no location at all. */
  directionsHref: string | null;
  /**
   * Route to a public venue page. Omitted while no such route exists — a venue
   * record only surfaces through admin routes today (`/admin/venues/:id`), so
   * rendering the CTA would be a dead end.
   */
  venuePageHref?: string | null;
}

/**
 * Adds the city line only when the free-text address does not already carry
 * it, so the card never repeats or invents address data.
 */
function cityLine(streetAddress: string | null, cityLabel: string | null): string | null {
  if (!cityLabel) return null;
  if (streetAddress && streetAddress.toLowerCase().includes(cityLabel.toLowerCase())) return null;
  return cityLabel;
}

/**
 * Venue card for the event detail sidebar: a stylized location preview above
 * the canonical venue fields, then the directions/venue actions.
 *
 * The preview is drawn from design tokens rather than a map tile service: no
 * map-image API is configured for this project, and a paid dependency is not
 * worth the visual polish. It communicates "this is the event location" with a
 * pin and an explicit "Map preview" caption instead of implying live map data.
 */
export default function VenueMapCard({
  venueName,
  streetAddress,
  cityLabel,
  directionsHref,
  venuePageHref = null,
}: VenueMapCardProps) {
  if (!venueName && !streetAddress) return null;

  const city = cityLine(streetAddress, cityLabel);

  return (
    <section className="venue-card" aria-labelledby="venue-card-label">
      <div className="venue-card__preview">
        <div className="venue-card__grid" aria-hidden="true" />
        <span className="venue-card__pin" aria-hidden="true">
          <MapPin size={26} />
        </span>
        <span className="venue-card__preview-label">Map preview</span>
      </div>

      <div className="venue-card__body">
        <h2 className="venue-card__label" id="venue-card-label">
          Where
        </h2>
        {venueName && <p className="venue-card__venue">{venueName}</p>}
        {streetAddress && <p className="venue-card__address">{streetAddress}</p>}
        {city && <p className="venue-card__address">{city}</p>}

        {(venuePageHref || directionsHref) && (
          <div className="venue-card__actions">
            {venuePageHref && (
              <Link className="venue-card__cta" to={venuePageHref}>
                Venue page <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
            {directionsHref && (
              <a
                className="venue-card__cta"
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions <ArrowRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
