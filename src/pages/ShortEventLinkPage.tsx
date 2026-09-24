import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { fetchShortLinkMatches } from "../features/events/api/eventsRepo";
import { normalizeShortEventCode } from "../features/events/model/shortLink";
import NotFoundPage from "./NotFoundPage";
import "./EventDetailPage.css";

/**
 * Resolves a printed short link (`/e/<code>`) to its event page. A unique
 * match redirects in place; a collision lists the candidates instead of
 * guessing which night the poster meant.
 */
export default function ShortEventLinkPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeShortEventCode(rawCode);

  const {
    data: matches,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["event", "short-code", code],
    queryFn: () => fetchShortLinkMatches(code!),
    enabled: code !== null,
  });

  if (code === null) return <NotFoundPage />;

  if (isLoading) {
    return (
      <div className="event-page event-page--status" role="status">
        Finding the event…
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-page event-page--status" role="alert">
        <p>We couldn&apos;t look up this event link.</p>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!matches || matches.length === 0) return <NotFoundPage />;
  if (matches.length === 1) return <Navigate to={`/events/${matches[0].id}`} replace />;

  return (
    <div className="event-page event-page--status" role="status">
      <p>This link matches more than one event.</p>
      <ul>
        {matches.map(({ id, title }) => (
          <li key={id}>
            <Link to={`/events/${id}`}>{title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
