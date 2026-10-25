import { Link } from "react-router-dom";
import { useCity } from "../../../contexts/useCity";
import { eventCountLabel, formatDistance } from "../model/metro";
import "./MetroSuggestions.css";

interface MetroSuggestionsProps {
  /** How many metros to offer. */
  limit?: number;
  /** Heading id the list is labelled by. */
  labelledBy: string;
}

/**
 * The closest active metros (by inventory when the visitor's area is
 * unknown), excluding the one on screen. Links, so each is a real URL.
 */
export default function MetroSuggestions({ limit = 3, labelledBy }: MetroSuggestionsProps) {
  const { city, activeMetros, setCity } = useCity();
  const suggestions = activeMetros.filter((metro) => metro.slug !== city).slice(0, limit);
  if (suggestions.length === 0) return null;

  return (
    <ul className="metro-suggestions" aria-labelledby={labelledBy}>
      {suggestions.map((metro) => {
        const distance = formatDistance(metro.distanceKm);
        return (
          <li key={metro.slug}>
            <Link
              to={`/events/${metro.slug}`}
              className="metro-suggestions__link"
              onClick={() => setCity(metro.slug)}
            >
              <span className="metro-suggestions__name">{metro.name}</span>
              <span className="metro-suggestions__meta">
                {eventCountLabel(metro.upcomingEventCount)}
                {distance && ` · ${distance}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
