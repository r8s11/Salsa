import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Search, Users, QrCode } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import { useMyOrganizerEvents } from "../features/host/hooks/useMyOrganizerEvents";
import { useEventAttendanceSummaries } from "../features/host/hooks/useEventAttendanceSummaries";
import { isUpcomingHostEvent } from "../features/host/model/hostEvents";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import EventShareControls from "../features/events/components/EventShareControls";
import { fromEventDateInstant, formatTimeLabel } from "../features/events/model/eventDateTime";
import "./HostMyEventsPage.css";

/* ── Types ── */

type EventGroup = "upcoming" | "drafts" | "past" | "cancelled";

type FilterValue = "all" | EventGroup;

interface FilterOption {
  value: FilterValue;
  label: string;
}

/* ── Constants ── */

const FILTERS: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "drafts", label: "Drafts" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

/* ── Helpers ── */

function parseEventInstant(eventDate: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(eventDate);
  } catch {
    return null;
  }
}

function formatEventDate(event: DatabaseEvent): string {
  const instant = parseEventInstant(event.event_date);
  if (!instant) return "Date unavailable";

  const { date, time } = fromEventDateInstant(instant.toString());
  const [year, month, day] = date.split("-").map(Number);
  const displayDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const displayTime = formatTimeLabel(time);
  return `${displayDate} · ${displayTime}`;
}

function getEventGroup(event: DatabaseEvent, now: Date): EventGroup {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "draft") return "drafts";

  const instant = parseEventInstant(event.event_date);
  if (instant && instant.epochMilliseconds <= now.getTime()) return "past";
  if (isUpcomingHostEvent(event, now)) return "upcoming";

  // Events with pending/rejected status and future dates are "upcoming"
  if (event.status === "pending" || event.status === "rejected") {
    return "upcoming";
  }

  return "past";
}

function matchesSearch(event: DatabaseEvent, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    event.title.toLowerCase().includes(q) ||
    event.location?.toLowerCase().includes(q) ||
    event.city?.toLowerCase().includes(q) ||
    event.host?.toLowerCase().includes(q) ||
    false
  );
}

function sortEventsByDate(events: DatabaseEvent[], ascending: boolean): DatabaseEvent[] {
  return [...events].sort((a, b) => {
    const aInstant = parseEventInstant(a.event_date);
    const bInstant = parseEventInstant(b.event_date);
    if (!aInstant && !bInstant) return 0;
    if (!aInstant) return 1;
    if (!bInstant) return -1;
    return ascending
      ? aInstant.epochMilliseconds - bInstant.epochMilliseconds
      : bInstant.epochMilliseconds - aInstant.epochMilliseconds;
  });
}

function sortEventsByUpdated(events: DatabaseEvent[]): DatabaseEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/* ── Event Card ── */

interface EventCardProps {
  event: DatabaseEvent;
  attendeeCount: number | null;
  checkedInCount: number | null;
  canManage: boolean;
}

function EventCard({ event, attendeeCount, checkedInCount, canManage }: EventCardProps) {
  const dateLabel = formatEventDate(event);
  const hasAttendanceData = attendeeCount !== null;
  const hasCheckInData = checkedInCount !== null;

  return (
    <li className="host-my-events__card">
      {/* Flyer */}
      <div className="host-my-events__card-flyer">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={`${event.title} flyer`}
            className="host-my-events__card-flyer-img"
          />
        ) : (
          <div className="host-my-events__card-flyer-fallback">
            <span className="host-my-events__card-flyer-icon">💃</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="host-my-events__card-body">
        <div className="host-my-events__card-header">
          <AdminStatusBadge status={event.status} />
        </div>

        <h3 className="host-my-events__card-title">
          <Link to={canManage ? `/host/events/${event.id}` : `/events/${event.id}`}>
            {event.title}
          </Link>
        </h3>

        <div className="host-my-events__card-meta">
          <span className="host-my-events__card-date">
            <Calendar size={13} aria-hidden="true" />
            {dateLabel}
          </span>
          {event.location && (
            <span className="host-my-events__card-location">
              <MapPin size={13} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>

        {/* Attendance summary */}
        {hasAttendanceData && (
          <div className="host-my-events__card-attendance">
            {attendeeCount === 0 && checkedInCount === 0 ? (
              <span className="host-my-events__card-attendance-empty">No attendees yet</span>
            ) : (
              <>
                <span className="host-my-events__card-stat">
                  <Users size={13} aria-hidden="true" />
                  {attendeeCount} {attendeeCount === 1 ? "attendee" : "attendees"}
                </span>
                {hasCheckInData && checkedInCount > 0 && (
                  <span className="host-my-events__card-stat">
                    <QrCode size={13} aria-hidden="true" />
                    {checkedInCount} checked in
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {!hasAttendanceData && (
          <div className="host-my-events__card-attendance">
            <span className="host-my-events__card-attendance-empty">Attendance unavailable</span>
          </div>
        )}

        {/* Actions */}
        <div className="host-my-events__card-actions">
          {canManage ? (
            <Link
              to={`/host/events/${event.id}`}
              className="admin-btn admin-btn--primary host-my-events__card-btn"
            >
              Manage Event
            </Link>
          ) : (
            <Link
              to={`/events/${event.id}`}
              className="admin-btn admin-btn--secondary host-my-events__card-btn"
            >
              View Event
            </Link>
          )}
          {event.status === "approved" && (
            <EventShareControls
              compact
              eventId={event.id}
              title={event.title}
              dateLabel={dateLabel}
              location={event.location}
            />
          )}
        </div>
      </div>
    </li>
  );
}

/* ── Main Component ── */

export default function HostMyEventsPage() {
  const { user } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const { data: organizers = [] } = useMyOrganizers();
  const organizerEvents = useMyOrganizerEvents();

  // State
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // Derive permissions
  const canCreate = organizers.some(
    (o) =>
      o.organizerStatus === "active" &&
      (o.memberRole === "owner" || o.memberRole === "manager")
  );
  const isEditor = organizers.some(
    (o) => o.organizerStatus === "active" && o.memberRole === "editor"
  );
  const canManage = !!canCreate; // owner/manager can manage

  // Merge all owned events
  const allEvents = useMemo(() => {
    const byId = new Map(
      [...submissions, ...approvedEvents, ...organizerEvents.events].map(
        (event) => [event.id, event] as const
      )
    );
    return [...byId.values()];
  }, [submissions, approvedEvents, organizerEvents.events]);

  // Filter by selected organizer
  const organizerFiltered = useMemo(() => {
    if (!selectedOrganizerId) return allEvents;
    return allEvents.filter((e) => e.organizer_id === selectedOrganizerId);
  }, [allEvents, selectedOrganizerId]);

  // Filter by search
  const searched = useMemo(
    () => organizerFiltered.filter((e) => matchesSearch(e, search)),
    [organizerFiltered, search]
  );

  // Group events
  const groups = useMemo(() => {
    const result: Record<EventGroup, DatabaseEvent[]> = {
      upcoming: [],
      drafts: [],
      past: [],
      cancelled: [],
    };

    for (const event of searched) {
      const group = getEventGroup(event, now);
      result[group].push(event);
    }

    // Sort within groups
    result.upcoming = sortEventsByDate(result.upcoming, true); // soonest first
    result.past = sortEventsByDate(result.past, false); // most recent first
    result.drafts = sortEventsByUpdated(result.drafts); // most recently updated first
    result.cancelled = sortEventsByDate(result.cancelled, false);

    return result;
  }, [searched, now]);

  // Determine visible groups based on filter
  const visibleGroups = useMemo(() => {
    if (filter === "all") {
      return (["upcoming", "drafts", "past", "cancelled"] as EventGroup[]).filter(
        (g) => groups[g].length > 0
      );
    }
    return groups[filter].length > 0 ? [filter] : [];
  }, [filter, groups]);

  // Collect event IDs for attendance summaries
  const eventIds = useMemo(() => searched.map((e) => e.id), [searched]);
  const { summaries, isLoading: summariesLoading, error: summariesError } = useEventAttendanceSummaries(eventIds);
  const attendanceAvailable = !summariesLoading && !summariesError;

  // Loading state
  const isLoadingData = isLoading || organizerEvents.isLoading;
  const hasError = error || organizerEvents.error;

  // Organizer selector options (only active memberships)
  const activeOrganizers = useMemo(
    () => organizers.filter((o) => o.organizerStatus === "active"),
    [organizers]
  );
  const showOrganizerFilter = activeOrganizers.length > 1;

  // Current organizer name for header
  const currentOrganizerName = useMemo(() => {
    if (!selectedOrganizerId) return null;
    return activeOrganizers.find((o) => o.organizerId === selectedOrganizerId)?.organizerName ?? null;
  }, [selectedOrganizerId, activeOrganizers]);

  // Group labels
  const GROUP_LABELS: Record<EventGroup, string> = {
    upcoming: "Upcoming",
    drafts: "Drafts",
    past: "Past",
    cancelled: "Cancelled",
  };

  return (
    <main className="admin-shell">
      {/* Header */}
      <AdminPageHeader
        title="My Events"
        description={
          currentOrganizerName
            ? `Manage events for ${currentOrganizerName}.`
            : "Manage your upcoming, draft, and past events."
        }
        actions={
          canCreate ? (
            <Link to="/host/events/new" className="admin-btn admin-btn--primary">
              + Create Event
            </Link>
          ) : isEditor ? (
            <span className="host-my-events__view-only">View only</span>
          ) : undefined
        }
      />

      {/* Error banner */}
      {hasError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load your events.</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => {
              void refetch();
              void organizerEvents.refetch();
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Controls */}
      {!hasError && (
        <div className="host-my-events__controls">
          {/* Search */}
          <div className="host-my-events__search">
            <Search size={16} aria-hidden="true" className="host-my-events__search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your events..."
              className="host-my-events__search-input"
              aria-label="Search events"
            />
          </div>

          <div className="host-my-events__controls-row">
            {/* Organizer filter */}
            {showOrganizerFilter && (
              <select
                value={selectedOrganizerId ?? ""}
                onChange={(e) => setSelectedOrganizerId(e.target.value || null)}
                className="host-my-events__organizer-select"
                aria-label="Filter by organizer"
              >
                <option value="">All organizers</option>
                {activeOrganizers.map((o) => (
                  <option key={o.organizerId} value={o.organizerId}>
                    {o.organizerName}
                  </option>
                ))}
              </select>
            )}

            {/* Status filters */}
            <div className="host-my-events__filters" role="group" aria-label="Event status">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`host-my-events__filter${
                    filter === option.value ? " host-my-events__filter--active" : ""
                  }`}
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                  {option.value !== "all" && groups[option.value].length > 0 && (
                    <span className="host-my-events__filter-count">
                      {groups[option.value].length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoadingData && (
        <p role="status" className="host-my-events__status">
          Loading your events…
        </p>
      )}

      {/* Empty state — no events at all */}
      {!isLoadingData && !hasError && allEvents.length === 0 && (
        <div className="admin-card host-my-events__empty">
          <h2 className="host-my-events__empty-title">No events yet</h2>
          <p>
            {canCreate
              ? "Create your first SalsaSegura event and start managing it from your Host workspace."
              : "No events are available for this Organizer yet."}
          </p>
          {canCreate && (
            <Link to="/host/events/new" className="admin-btn admin-btn--primary">
              Create Event
            </Link>
          )}
        </div>
      )}

      {/* Empty filter state */}
      {!isLoadingData && !hasError && allEvents.length > 0 && visibleGroups.length === 0 && (
        <div className="admin-card host-my-events__empty">
          <p>No {filter} events found.</p>
        </div>
      )}

      {/* Event groups */}
      {!isLoadingData && !hasError && visibleGroups.length > 0 && (
        <div className="host-my-events__groups">
          {visibleGroups.map((group) => (
            <section key={group} className="host-my-events__group" aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="host-my-events__group-title">
                {GROUP_LABELS[group]}
                <span className="host-my-events__group-count">{groups[group].length}</span>
              </h2>
              <ul className="host-my-events__cards">
                {groups[group].map((event) => {
                  const summary = summaries.get(event.id);
                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      attendeeCount={attendanceAvailable ? (summary?.attendeeCount ?? 0) : null}
                      checkedInCount={attendanceAvailable ? (summary?.checkedInCount ?? 0) : null}
                      canManage={canManage}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
