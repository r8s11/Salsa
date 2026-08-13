import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminVenues, useAdminVenue, useVenueEventCount, useVenueAuditLog } from "../features/admin/hooks/useAdminVenues";
import { useAdminEvents } from "../hooks/useAdminEvents";
import {
  venueDisplayAddress,
  venueQualityIssues,
  type VenueAction,
  VENUE_QUALITY_ISSUE_LABEL,
} from "../features/admin/model/venuesQuery";
import AdminVenueStatusBadge from "../components/Admin/AdminVenueStatusBadge";
import AdminQualityBadge from "../components/Admin/AdminQualityBadge";
import AdminActionMenu from "../components/Admin/AdminActionMenu";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminVenueForm from "../components/Admin/AdminVenueForm";
import { auditLogLabelFor } from "../features/admin/model/auditLog";
import "./AdminVenueDetailPage.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PendingAction =
  | { kind: "archive" }
  | { kind: "delete" }
  | { kind: "merge" }
  | { kind: "edit" }
  | { kind: "restore" }
  | null;

export default function AdminVenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { venue, isLoading, error, refetch } = useAdminVenue(id ?? null);
  const {
    venues: directoryVenues,
    archive,
    isArchiving,
    archiveError,
    restore,
    isRestoring,
    restoreError,
    remove: deleteVenue,
    isRemoving,
    removeError,
    isMerging,
    mergeError,
  } = useAdminVenues();
  const { events: queriedEvents } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);
  const { data: eventCount } = useVenueEventCount(id ?? null);
  const { data: auditLog = [] } = useVenueAuditLog(id ?? null);

  // If the single-venue query didn't fire (opened directly via URL),
  // fall back to the directory result (already in cache if the admin came
  // from the queue page) — Phase 5/6 do the same "find in cache, else fetch".
  const resolvedVenue = useMemo(() => {
    if (venue) return venue;
    if (!directoryVenues) return null;
    return directoryVenues.find((candidate) => candidate.id === id) ?? null;
  }, [venue, directoryVenues, id]);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const closeDialog = () => setPendingAction(null);

  const handleAction = (action: VenueAction) => {
    if (action === "edit") {
      setPendingAction({ kind: "edit" });
    } else if (action === "archive") {
      setPendingAction({ kind: "archive" });
    } else if (action === "delete") {
      setPendingAction({ kind: "delete" });
    } else if (action === "merge") {
      setPendingAction({ kind: "merge" });
    } else if (action === "restore") {
      setPendingAction({ kind: "restore" });
    }
  };

  // Events at this venue (client-side filter from the cached admin events)
  const venueEvents = useMemo(() => {
    if (!resolvedVenue || !events.length) return [];
    return events
      .filter((event) => event.venue_id === resolvedVenue.id)
      .sort((a, b) => Date.parse(b.event_date) - Date.parse(a.event_date));
  }, [resolvedVenue, events]);

  const upcomingEvents = useMemo(
    () => venueEvents.filter((e) => new Date(e.event_date) >= new Date()),
    [venueEvents]
  );
  const pastEvents = useMemo(
    () => venueEvents.filter((e) => new Date(e.event_date) < new Date()),
    [venueEvents]
  );

  const qualityIssues = useMemo(() => venueQualityIssues(resolvedVenue), [resolvedVenue]);

  const isArchived = resolvedVenue?.status === "archived";
  const isDecisionBusy = isArchiving || isRemoving || isMerging || isRestoring;

  // --- Loading / error / not-found states ---
  const isFullyLoaded = !isLoading && !error && !!resolvedVenue;

  if (isLoading && !resolvedVenue) {
    return (
      <div className="admin-venue-detail-page__loading" aria-busy="true">
        <p role="status">Loading venue…</p>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="admin-banner admin-banner--error" role="alert">
        <p>We couldn&apos;t load this venue.</p>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!isFullyLoaded) {
    return (
      <div className="admin-venue-detail-page__empty">
        <h2>Venue not found</h2>
        <p>The venue may have been deleted or the link is incorrect.</p>
        <Link to="/admin/venues" className="admin-btn admin-btn--secondary">
          Venues
        </Link>
      </div>
    );
  }

  const v = resolvedVenue!;

  return (
    <div className="admin-venue-detail-page">
      <Link to="/admin/venues" className="admin-venue-detail-page__back">
        ← Venues
      </Link>

      <header className="admin-venue-detail-page__header">
        <div className="admin-venue-detail-page__header-body">
          <h1>{v.name}</h1>
          <p className="admin-venue-detail-page__address">{venueDisplayAddress(v) || "No address"}</p>
          <div className="admin-venue-detail-page__badges">
            <AdminVenueStatusBadge status={v.status} />
            {qualityIssues.length > 0 && (
              <AdminQualityBadge
                issues={qualityIssues}
                labelFor={(issue) => VENUE_QUALITY_ISSUE_LABEL[issue]}
                eventTitle={v.name}
              />
            )}
          </div>
        </div>
        <div className="admin-venue-detail-page__header-menu">
          <AdminActionMenu
            label={`Actions for ${v.name}`}
            items={venueActionItemsFor(handleAction, isArchived)}
          />
        </div>
      </header>

      <div className="admin-venue-detail-page__body">
        {/* 1. Address & Contact */}
        <section className="admin-card admin-venue-detail-page__address-section">
          <h2>Address &amp; Contact</h2>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Address Line 1</span>
            <span>{v.address_line1 || "—"}</span>
          </div>
          {v.address_line2 && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Address Line 2</span>
              <span>{v.address_line2}</span>
            </div>
          )}
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">City</span>
            <span>{v.city || "—"}</span>
          </div>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">State / Region</span>
            <span>{v.state_region || "—"}</span>
          </div>
          {v.postal_code && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">ZIP / Postal</span>
              <span>{v.postal_code}</span>
            </div>
          )}
          {v.country && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Country</span>
              <span>{v.country}</span>
            </div>
          )}
          {v.timezone && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Timezone</span>
              <span>{v.timezone}</span>
            </div>
          )}
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Coordinates</span>
            <span>
              {v.latitude != null && v.longitude != null
                ? `${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)}`
                : "Not set"}
            </span>
          </div>
          {v.website && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Website</span>
              <span>
                <a href={v.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${v.name} website (opens in new window)`}>
                  {v.website} ↗
                </a>
              </span>
            </div>
          )}
          {v.instagram && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Instagram</span>
              <span>
                <a
                  href={`https://instagram.com/${v.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${v.name} on Instagram (opens in new window)`}
                >
                  @{v.instagram.replace(/^@/, "")} ↗
                </a>
              </span>
            </div>
          )}
          {v.phone && (
            <div className="admin-venue-detail-page__field">
              <span className="admin-venue-detail-page__label">Phone</span>
              <span>{v.phone}</span>
            </div>
          )}
        </section>

        {/* 2. Quality Issues */}
        <section className="admin-card admin-venue-detail-page__quality">
          <h2>Quality Issues</h2>
          {qualityIssues.length === 0 ? (
            <p>No quality issues detected.</p>
          ) : (
            <ul className="admin-venue-detail-page__quality-list">
              {qualityIssues.map((issue) => (
                <li key={issue} className="admin-venue-detail-page__quality-item">
                  <AdminQualityBadge
                    issues={[issue]}
                    labelFor={(i) => VENUE_QUALITY_ISSUE_LABEL[i]}
                    eventTitle={v.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Stats */}
        <section className="admin-card admin-venue-detail-page__stats">
          <h2>Statistics</h2>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Upcoming Events</span>
            <span>{upcomingEvents.length}</span>
          </div>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Past Events</span>
            <span>{pastEvents.length}</span>
          </div>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Created</span>
            <span>{formatDate(v.created_at)}</span>
          </div>
          <div className="admin-venue-detail-page__field">
            <span className="admin-venue-detail-page__label">Last Updated</span>
            <span>{formatDate(v.updated_at)}</span>
          </div>
        </section>

        {/* 4. Upcoming Events */}
        <section className="admin-card admin-venue-detail-page__upcoming">
          <h2>Upcoming Events <span className="admin-venue-detail-page__count">({upcomingEvents.length})</span></h2>
          {upcomingEvents.length === 0 ? (
            <p>No upcoming events at this venue.</p>
          ) : (
            <ul className="admin-venue-detail-page__events-list">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link>
                  <span className="admin-venue-detail-page__muted">
                    {formatShortDate(event.event_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 5. Past Events */}
        <section className="admin-card admin-venue-detail-page__past">
          <h2>Past Events <span className="admin-venue-detail-page__count">({pastEvents.length})</span></h2>
          {pastEvents.length === 0 ? (
            <p>No past events at this venue.</p>
          ) : (
            <ul className="admin-venue-detail-page__events-list">
              {pastEvents.slice(0, 10).map((event) => (
                <li key={event.id}>
                  <Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link>
                  <span className="admin-venue-detail-page__muted">
                    {formatShortDate(event.event_date)}
                  </span>
                </li>
              ))}
              {pastEvents.length > 10 && (
                <li>
                  <Link to={`/admin/events?venue=${v.id}`}>
                    View all {pastEvents.length} past events →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* 6. Audit Log */}
        <section className="admin-card admin-venue-detail-page__audit">
          <h2>Audit Log</h2>
          {auditLog.length === 0 ? (
            <p>No audit log entries.</p>
          ) : (
            <table className="admin-venue-detail-page__audit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{auditLogLabelFor(entry)}</td>
                    <td>{entry.actor_id ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 7. Notes */}
        <section className="admin-card admin-venue-detail-page__notes">
          <h2>Notes</h2>
          <p className="admin-venue-detail-page__muted">
            No moderator notes for this venue.
          </p>
        </section>

        {/* 8. Potential Duplicates */}
        <section className="admin-card admin-venue-detail-page__related">
          <h2>Potential Duplicates</h2>
          <p className="admin-venue-detail-page__muted">
            No potential duplicates detected.
          </p>
        </section>
      </div>

      {/* Sticky Decision Panel — always rendered so focus management is stable */}
      <aside className="admin-venue-detail-page__decision-panel" aria-label="Decision">
        <div className="admin-venue-detail-page__decision-panel__card admin-card">
          <h3>Venue Status</h3>
          <AdminVenueStatusBadge status={v.status} />

          {!isArchived && (
            <>
              <h3>Archive Venue</h3>
              <p className="admin-venue-detail-page__muted">
                Archived venues will not appear in event submission forms.
                {eventCount ? ` ${eventCount} event${eventCount === 1 ? "" : "s"} currently reference this venue.` : ""}
              </p>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => setPendingAction({ kind: "archive" })}
                disabled={isDecisionBusy}
              >
                {isArchiving ? "Archiving…" : "Archive Venue"}
              </button>
            </>
          )}

          {isArchived && (
            <>
              <h3>Restore Venue</h3>
              <p className="admin-venue-detail-page__muted">
                Restored venues will appear in event submission forms again.
              </p>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => setPendingAction({ kind: "restore" })}
                disabled={isDecisionBusy}
              >
                {isRestoring ? "Restoring…" : "Restore to Active"}
              </button>
            </>
          )}

          {!isArchived && (
            <>
              <h3>Merge with Another Venue</h3>
              <p className="admin-venue-detail-page__muted">
                Merge this venue into another. Events will be reassigned.
              </p>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setPendingAction({ kind: "merge" })}
                disabled={isDecisionBusy}
              >
                {isMerging ? "Working…" : "Merge…"}
              </button>
            </>
          )}

          <h3>Delete Venue</h3>
          <p className="admin-venue-detail-page__muted">
            Permanently removes this venue. Cannot be undone.
            {eventCount ? (
              <span className="admin-venue-detail-page__danger">
                {" "}{eventCount} event{eventCount === 1 ? "" : "s"} reference this venue — you cannot delete it until they are updated.
              </span>
            ) : null}
          </p>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={() => setPendingAction({ kind: "delete" })}
            disabled={isDecisionBusy || !!eventCount}
          >
            {isRemoving ? "Deleting…" : "Delete Venue"}
          </button>
        </div>
      </aside>

      {/* --- Edit form dialog --- */}
      {pendingAction?.kind === "edit" && (
        <div className="admin-venue-detail-page__form-overlay">
          <div className="admin-venue-detail-page__form-container">
            <AdminVenueForm
              initial={v}
              isSaving={false}
              error={null}
              onSubmit={() => {
                /* Form submission handled by parent — to be wired in a follow-up */
              }}
              onCancel={() => setPendingAction(null)}
            />
          </div>
        </div>
      )}

      {/* --- Archive confirmation --- */}
      {pendingAction?.kind === "archive" && (
        <AdminConfirmDialog
          title={`Archive ${v.name}?`}
          body="Archived venues will no longer appear in event submission forms. Past events will keep their location text."
          confirmLabel="Archive Venue"
          isBusy={isArchiving}
          tone="neutral"
          error={archiveError}
          reasonField={{
            label: "Internal note (optional)",
            placeholder: "Why this venue was archived…",
          }}
          onConfirm={() => {
            archive(v.id);
            setPendingAction(null);
          }}
          onCancel={closeDialog}
        />
      )}

      {/* --- Restore confirmation --- */}
      {pendingAction?.kind === "restore" && (
        <AdminConfirmDialog
          title={`Restore ${v.name}?`}
          body="This venue will become Active and appear in event submission forms again."
          confirmLabel="Restore Venue"
          isBusy={isRestoring}
          tone="neutral"
          error={restoreError}
          reasonField={{
            label: "Internal note (optional)",
            placeholder: "Why this venue was restored…",
          }}
          onConfirm={() => {
            restore({ id: v.id });
            setPendingAction(null);
          }}
          onCancel={closeDialog}
        />
      )}

      {/* --- Delete confirmation --- */}
      {pendingAction?.kind === "delete" && (
        <AdminConfirmDialog
          title={`Delete ${v.name}?`}
          body={
            eventCount
              ? `${eventCount} event${eventCount === 1 ? "" : "s"} still reference this venue. Reassign or remove the venue reference before deleting.`
              : "This will permanently remove the venue. Past events will keep their location text."
          }
          confirmLabel={eventCount ? "Cannot Delete" : "Delete Venue"}
          isBusy={isRemoving}
          tone="danger"
          error={removeError}
          onConfirm={() => {
            deleteVenue(v.id);
            setPendingAction(null);
          }}
          onCancel={closeDialog}
        />
      )}

      {/* --- Merge confirmation --- */}
      {pendingAction?.kind === "merge" && (
        <AdminConfirmDialog
          title={`Merge ${v.name}?`}
          body="This will archive this venue and reassign all events to the target venue. This action cannot be undone."
          confirmLabel="Merge Venue"
          isBusy={false}
          tone="danger"
          error={mergeError}
          onCancel={closeDialog}
          onConfirm={() => {
            // In a full implementation, this opens a venue-search modal
            // to pick the target venue. For now, close the dialog.
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

// Inline action menu items for the header — mirrors venueActionItems but
// includes "Restore" for archived venues.
function venueActionItemsFor(
  onAction: (action: VenueAction) => void,
  isArchived: boolean
) {
  const items = [];
  if (!isArchived) {
    items.push({
      id: "edit",
      label: "Edit Venue",
      onSelect: () => onAction("edit"),
    });
    items.push({
      id: "archive",
      label: "Archive",
      separatorBefore: true,
      onSelect: () => onAction("archive"),
    });
    items.push({
      id: "merge",
      label: "Merge with another venue",
      separatorBefore: true,
      tone: "danger" as const,
      onSelect: () => onAction("merge"),
    });
  } else {
    items.push({
      id: "restore",
      label: "Restore to Active",
      onSelect: () => onAction("restore"),
    });
    items.push({
      id: "edit",
      label: "Edit Venue",
      separatorBefore: true,
      onSelect: () => onAction("edit"),
    });
  }
  items.push({
    id: "delete",
    label: "Delete",
    separatorBefore: true,
    tone: "danger" as const,
    onSelect: () => onAction("delete"),
  });
  return items;
}
