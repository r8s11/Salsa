import { useState, useMemo } from "react";
import posthog from "posthog-js";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2, Undo2, RotateCcw } from "lucide-react";
import { useEventAttendees } from "../../features/host/hooks/useEventAttendees";
import { useEventCheckIns } from "../../features/host/hooks/useEventCheckIns";
import { summarizeAttendance } from "../../features/host/model/attendance";
import "../../styles/admin.css";
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
  const [actionError, setActionError] = useState<string | null>(null);

  const activeCheckIns = useMemo(() => checkIns.filter((c) => !c.reversedAt), [checkIns]);

  const activeByAttendee = useMemo(
    () => new Map(activeCheckIns.map((c) => [c.attendeeId, c])),
    [activeCheckIns]
  );

  const reversals = useMemo(
    () =>
      checkIns
        .filter((c) => c.reversedAt)
        .sort((a, b) => (b.reversedAt ?? "").localeCompare(a.reversedAt ?? "")),
    [checkIns]
  );

  const counts = useMemo(() => summarizeAttendance(attendees, checkIns), [attendees, checkIns]);

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter(
      (a) => a.displayName.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
    );
  }, [attendees, search]);

  const isLoading = attendeesLoading || checkInsLoading;
  const error = attendeesError || checkInsError;

  const isMutating = isCheckingIn || isReversing;

  async function handleCheckIn(attendeeId: string) {
    // One active arrival per attendee; the database enforces this too.
    if (activeByAttendee.has(attendeeId) || isMutating) return;
    setActionError(null);
    try {
      await checkIn({ attendeeId, method });
      posthog.capture("attendee_checked_in", { method });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not check in this attendee.");
      refetchCheckIns();
    }
  }

  async function handleUndo(checkInId: string) {
    if (isMutating) return;
    setActionError(null);
    try {
      await reverseCheckIn({ checkInId });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not undo this check-in.");
      refetchCheckIns();
    }
  }

  function refetch() {
    refetchAttendees();
    refetchCheckIns();
  }

  return (
    <div className="admin-shell">
      <div className="host-checkin">
        <Link to={`/host/events/${eventId}`} className="host-checkin__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Event
        </Link>

        <h1 className="host-checkin__title">Door Check-in</h1>
        <p className="host-checkin__subtitle">
          {counts.checkedInEntries} of {counts.rosterEntries} roster{" "}
          {counts.rosterEntries === 1 ? "entry" : "entries"} checked in ·{" "}
          {counts.checkedInHeadcount} of {counts.headcount} headcount arrived
        </p>

        {isLoading && (
          <p className="host-checkin__status" role="status">
            Loading…
          </p>
        )}

        {error && (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>{error}</p>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={refetch}>
              Try Again
            </button>
          </div>
        )}

        {actionError && (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>{actionError}</p>
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
                  const activeCheckIn = activeByAttendee.get(attendee.id);
                  return (
                    <div
                      key={attendee.id}
                      className={`host-checkin__card ${activeCheckIn ? "host-checkin__card--checked-in" : ""}`}
                    >
                      <div className="host-checkin__card-info">
                        <span className="host-checkin__card-name">{attendee.displayName}</span>
                        <span className="host-checkin__card-meta">
                          {attendee.category.replace("_", " ")}
                          {attendee.partySize > 1 && ` · +${attendee.partySize - 1}`}
                        </span>
                      </div>
                      <div className="host-checkin__card-actions">
                        {activeCheckIn ? (
                          <>
                            <span className="host-checkin__checked-badge">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              Checked in
                            </span>
                            <button
                              type="button"
                              className="admin-btn admin-btn--secondary host-checkin__undo-btn"
                              onClick={() => handleUndo(activeCheckIn.id)}
                              disabled={isMutating}
                              aria-label={`Undo check-in for ${attendee.displayName}`}
                            >
                              <Undo2 size={14} aria-hidden="true" />
                              Undo check-in
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary host-checkin__checkin-btn"
                            onClick={() => handleCheckIn(attendee.id)}
                            disabled={isMutating}
                            aria-label={`Check in ${attendee.displayName}`}
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
            {reversals.length > 0 && (
              <section className="host-checkin__reversals">
                <h2 className="host-checkin__reversals-title">Recent Reversals</h2>
                {reversals.slice(0, 10).map((c) => {
                  const attendee = attendees.find((a) => a.id === c.attendeeId);
                  return (
                    <div key={c.id} className="host-checkin__reversal-row">
                      <span className="host-checkin__reversal-name">
                        {attendee?.displayName ?? "Unknown"}
                      </span>
                      <span className="host-checkin__reversal-time">
                        Reversed at {formatTime(c.reversedAt!)}
                      </span>
                      {attendee && !activeByAttendee.has(attendee.id) && (
                        <button
                          type="button"
                          className="admin-btn admin-btn--secondary host-checkin__recheck-btn"
                          onClick={() => handleCheckIn(c.attendeeId)}
                          disabled={isMutating}
                          aria-label={`Re-check-in ${attendee.displayName}`}
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          Re-check-in
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
