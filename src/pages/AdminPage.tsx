import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useCity } from "../contexts/useCity";
import { useAdminEvents } from "../hooks/useAdminEvents";
import type { DatabaseEvent } from "../features/events/model/types";
import { adminFormToPayload, buildAdminFormFromEvent, buildEmptyAdminForm, AdminEventForm } from "../features/admin/model/adminEventForm";
import AdminEventRow from "../components/Admin/AdminEventRow";
import AdminEventFormPanel from "../components/Admin/AdminEventFormPanel";
import "./AdminPage.css";

type AdminView = { mode: "list" } | { mode: "create" } | { mode: "edit"; event: DatabaseEvent };
type AdminFilter = "all" | DatabaseEvent["status"];

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdminPage() {
  const { user } = useAuth();
  const { city } = useCity();
  const {
    events: queriedEvents,
    isLoading,
    error,
    refetch,
    decide,
    decidingId,
    decidingStatus,
    decideErrorId,
    decideError,
    save,
    isSaving,
    saveError,
    remove,
    removingId,
    removeErrorId,
    removeError,
  } = useAdminEvents();
  const [view, setView] = useState<AdminView>({ mode: "list" });
  const [filter, setFilter] = useState<AdminFilter>("all");
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);
  const counts = useMemo(() => ({
    all: events.length,
    pending: events.filter((event) => event.status === "pending").length,
    approved: events.filter((event) => event.status === "approved").length,
    rejected: events.filter((event) => event.status === "rejected").length,
  }), [events]);
  const filteredEvents = useMemo(
    () => events.filter((event) => filter === "all" || event.status === filter),
    [events, filter]
  );
  const filters: readonly { value: AdminFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "approved", label: "Approved", count: counts.approved },
    { value: "rejected", label: "Rejected", count: counts.rejected },
  ];

  const submitForm = (form: AdminEventForm) => {
    const id = view.mode === "edit" ? view.event.id : null;
    save({ id, payload: adminFormToPayload(form) }, { onSuccess: () => setView({ mode: "list" }) });
  };

  if (view.mode !== "list") {
    const isEdit = view.mode === "edit";
    return (
      <main className="admin-page">
        <AdminEventFormPanel
          initial={isEdit ? buildAdminFormFromEvent(view.event) : buildEmptyAdminForm(city)}
          heading={isEdit ? "Edit event" : "New event"}
          submitLabel={isEdit ? "Save changes" : "Create event"}
          isSaving={isSaving}
          error={saveError}
          onSubmit={submitForm}
          onCancel={() => setView({ mode: "list" })}
        />
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Management workspace</p>
          <h1>All events</h1>
          {user?.email && <p className="admin-page-user">Signed in as {user.email}</p>}
        </div>
        <button type="button" className="btn-primary" onClick={() => setView({ mode: "create" })}>New event</button>
      </header>

      {isLoading && <p className="admin-page-status" role="status">Loading events…</p>}
      {!isLoading && error && (
        <div className="admin-page-status admin-page-error" role="alert">
          <p>Couldn't load events: {error}</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && (
        <>
          <section className="admin-page-metrics" aria-label="Event metrics">
            {[
              { label: "Total", value: counts.all },
              { label: "Pending", value: counts.pending },
              { label: "Approved", value: counts.approved },
            ].map((metric) => (
              <div className="admin-page-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </section>

          {events.length > 0 && (
            <div className="admin-page-filter-row" role="group" aria-label="Filter events by status">
              {filters.map(({ value, label, count }) => (
                <button
                  type="button"
                  key={value}
                  className="admin-page-filter"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label} {count}
                </button>
              ))}
            </div>
          )}

          {events.length === 0 ? (
            <section className="admin-page-empty" aria-labelledby="admin-empty-heading">
              <h2 id="admin-empty-heading">No events yet.</h2>
              <Link className="btn-secondary" to="/calendar">View calendar</Link>
            </section>
          ) : filteredEvents.length === 0 ? (
            <p className="admin-page-status">No {STATUS_LABEL[filter as DatabaseEvent["status"]].toLowerCase()} events.</p>
          ) : (
            <section className="admin-page-list" aria-label="All events">
              {filteredEvents.map((event) => (
                <AdminEventRow
                  key={event.id}
                  event={event}
                  onEdit={(nextEvent) => setView({ mode: "edit", event: nextEvent })}
                  onApprove={(id) => decide({ id, status: "approved" })}
                  onReject={(id) => decide({ id, status: "rejected" })}
                  onDelete={(id) => remove(id)}
                  decision={decidingId === event.id ? decidingStatus : null}
                  isDeleting={removingId === event.id}
                  error={decideErrorId === event.id ? decideError : removeErrorId === event.id ? removeError : null}
                />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
