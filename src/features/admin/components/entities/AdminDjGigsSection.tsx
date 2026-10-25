import { useState } from "react";
import { Link } from "react-router-dom";
import { useDebouncedSearch } from "../../../../shared/hooks/useDebouncedSearch";
import {
  useAdminDjEventCandidates,
  useAdminDjSetEvent,
} from "../../entities/hooks/useAdminEntities";
import type { AdminLinkedEvent } from "../../entities/model";
import "./AdminDjGigsSection.css";

interface AdminDjGigsSectionProps {
  djId: string;
  linkedEvents: AdminLinkedEvent[];
}

type GigChange = { eventId: string; linked: boolean };

const eventDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** The events a DJ plays: the linked list with Unlink, and a search to link more. */
export default function AdminDjGigsSection({ djId, linkedEvents }: AdminDjGigsSectionProps) {
  const [query, setQuery] = useState("");
  const { input, handleInput } = useDebouncedSearch(query, setQuery, 250);
  const search = useAdminDjEventCandidates(query.trim());
  const gigs = useAdminDjSetEvent(djId);
  const [failedChange, setFailedChange] = useState<GigChange | null>(null);
  const linkedIds = new Set(linkedEvents.map((event) => event.id));

  const change = (next: GigChange) => {
    setFailedChange(null);
    gigs.setEvent(next).catch(() => setFailedChange(next));
  };

  return (
    <section
      className="admin-card admin-dj-gigs"
      aria-labelledby="admin-dj-gigs-title"
      aria-busy={gigs.isPending || undefined}
    >
      <h2 id="admin-dj-gigs-title">
        Gigs <span className="admin-dj-gigs__count">({linkedEvents.length})</span>
      </h2>

      {gigs.error && failedChange && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{gigs.error}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--sm"
            onClick={() => change(failedChange)}
            disabled={gigs.isPending}
          >
            Try again
          </button>
        </div>
      )}

      {linkedEvents.length ? (
        <ul className="admin-dj-gigs__list">
          {linkedEvents.map((event) => (
            <li key={event.id} className="admin-dj-gigs__row">
              <span className="admin-dj-gigs__what">
                <Link className="admin-dj-gigs__title" to={`/admin/events?edit=${event.id}`}>
                  {event.title}
                </Link>
                <span className="admin-dj-gigs__meta">
                  <time dateTime={event.event_date}>{eventDate.format(new Date(event.event_date))}</time>
                  <span className="admin-dj-gigs__status">{event.status.replace(/_/g, " ")}</span>
                </span>
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                aria-label={`Unlink ${event.title}`}
                onClick={() => change({ eventId: event.id, linked: false })}
                disabled={gigs.isPending}
              >
                {gigs.pendingEventId === event.id ? "Unlinking…" : "Unlink"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-dj-gigs__quiet">No gigs linked yet.</p>
      )}

      <div className="admin-dj-gigs__add">
        <label htmlFor="admin-dj-gigs-search" className="admin-dj-gigs__label">
          Add a gig
        </label>
        <input
          id="admin-dj-gigs-search"
          type="search"
          className="admin-input"
          placeholder="Search events by title"
          autoComplete="off"
          value={input}
          onChange={(event) => handleInput(event.target.value)}
          aria-describedby="admin-dj-gigs-search-help"
        />
        <p id="admin-dj-gigs-search-help" className="admin-dj-gigs__quiet">
          {query.trim() ? "Approved events matching your search." : "Upcoming approved events, soonest first."}
        </p>

        {search.error ? (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>We couldn&apos;t search events: {search.error}</p>
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => search.refetch()}
            >
              Try again
            </button>
          </div>
        ) : search.isLoading ? (
          <p role="status" className="admin-dj-gigs__quiet">
            Searching events…
          </p>
        ) : search.candidates.length === 0 ? (
          <p role="status" className="admin-dj-gigs__quiet">
            No matching events.
          </p>
        ) : (
          <ul className="admin-dj-gigs__list" aria-label="Matching events">
            {search.candidates.map((candidate) => {
              const alreadyLinked = linkedIds.has(candidate.id);
              return (
                <li key={candidate.id} className="admin-dj-gigs__row">
                  <span className="admin-dj-gigs__what">
                    <span className="admin-dj-gigs__title">{candidate.title}</span>
                    <span className="admin-dj-gigs__meta">
                      <time dateTime={candidate.event_date}>
                        {eventDate.format(new Date(candidate.event_date))}
                      </time>
                      {candidate.location && <span>{candidate.location}</span>}
                    </span>
                  </span>
                  {alreadyLinked ? (
                    <span className="admin-dj-gigs__linked">Linked</span>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--sm"
                      aria-label={`Link ${candidate.title}`}
                      onClick={() => change({ eventId: candidate.id, linked: true })}
                      disabled={gigs.isPending}
                    >
                      {gigs.pendingEventId === candidate.id ? "Linking…" : "Link"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
