import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2, Undo2 } from "lucide-react";
import { useEventAttendees } from "../features/host/hooks/useEventAttendees";
import { useEventCheckIns } from "../features/host/hooks/useEventCheckIns";
import "../styles/admin.css";
import "./HostCheckInPage.css";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HostCheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    attendees,
    isLoading: attendeesLoading,
    error: attendeesError,
    refetch: refetchAttendees,
  } = useEventAttendees(eventId);

  const {
    checkIns,
    isLoading: checkInsLoading,
    error: checkInsError,
    refetch: refetchCheckIns,
    checkIn,
    isCheckingIn,
    reverseCheckIn,
    isReversing,
  } = useEventCheckIns(eventId);

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<"manual" | "door">("manual");

  const activeCheckIns = useMemo(
    () => checkIns.filter((c) => !c.reversedAt),
    [checkIns]
  );

  const checkedInIds = useMemo(
    () => new Set(activeCheckIns.map((c) => c.attendeeId)),
    [activeCheckIns]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    );
  }, [attendees, search]);

  const isLoading = attendeesLoading || checkInsLoading;
  const error = attendeesError || checkInsError;

  async function handleCheckIn(attendeeId: string) {
    try {
      await checkIn({ attendeeId, method });
    } catch {
      // error surfaced by hook
    }
  }

  async function handleReverse(checkInId: string) {
    try {
      await reverseCheckIn({ checkInId });
    } catch {
      // error surfaced by hook
    }
  }

  function refetch() {
    refetchAttendees();
    refetchCheckIns();
  }

  return (
    <main className="admin-shell">
      <div className="host-checkin">
        <Link
          to={`/host/events/${eventId}`}
          className="host-checkin__back"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Event
        </Link>

        <h1 className="host-checkin__title">Door Check-in</h1>
        <p className="host-checkin__subtitle">
          {activeCheckIns.length} checked in · {attendees.length} on roster
        </p>

        {isLoading && (
          <p className="host-checkin__status" role="status">Loading…</p>
        )}

        {error && (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={refetch}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ── Search ── */}
            <div className="host-checkin__search-bar">
              <Search size={16} aria-hidden="true" className="host-checkin__search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="host-checkin__search-input"
              />
              <div className="host-checkin__method-toggle">
                <button
                  type="button"
                  className={`host-checkin__method-btn ${method === "manual" ? "host-checkin__method-btn--active" : ""}`}
                  onClick={() => setMethod("manual")}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={`host-checkin__method-btn ${method === "door" ? "host-checkin__method-btn--active" : ""}`}
                  onClick={() => setMethod("door")}
                >
                  Door
                </button>
              </div>
            </div>

            {/* ── Roster ── */}
            {filtered.length === 0 && (
              <div className="host-checkin__empty">
                {search.trim()
                  ? "No attendees match your search."
                  : "No attendees on the roster. Add attendees first."}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="host-checkin__roster">
                {filtered.map((attendee) => {
                  const isCheckedIn = checkedInIds.has(attendee.id);
                  return (
                    <div
                      key={attendee.id}
                      className={`host-checkin__card ${isCheckedIn ? "host-checkin__card--checked-in" : ""}`}
                    >
                      <div className="host-checkin__card-info">
                        <span className="host-checkin__card-name">
                          {attendee.displayName}
                        </span>
                        <span className="host-checkin__card-meta">
                          {attendee.category.replace("_", " ")}
                          {attendee.partySize > 1 && ` · +${attendee.partySize - 1}`}
                        </span>
                      </div>
                      <div className="host-checkin__card-actions">
                        {isCheckedIn ? (
                          <span className="host-checkin__checked-badge">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Checked in
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary host-checkin__checkin-btn"
                            onClick={() => handleCheckIn(attendee.id)}
                            disabled={isCheckingIn}
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Recent reversals ── */}
            {checkIns.filter((c) => c.reversedAt).length > 0 && (
              <section className="host-checkin__reversals">
                <h2 className="host-checkin__reversals-title">Recent Reversals</h2>
                {checkIns
                  .filter((c) => c.reversedAt)
                  .slice(0, 10)
                  .map((c) => {
                    const attendee = attendees.find((a) => a.id === c.attendeeId);
                    return (
                      <div key={c.id} className="host-checkin__reversal-row">
                        <span className="host-checkin__reversal-name">
                          {attendee?.displayName ?? "Unknown"}
                        </span>
                        <span className="host-checkin__reversal-time">
                          Reversed at {formatTime(c.reversedAt!)}
                        </span>
                        <button
                          type="button"
                          className="attendee-action-btn"
                          onClick={() => handleReverse(c.id)}
                          disabled={isReversing}
                          aria-label={`Re-check-in ${attendee?.displayName ?? "attendee"}`}
                        >
                          <Undo2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
