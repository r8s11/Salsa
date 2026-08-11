import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useCity } from "../contexts/useCity";
import type { DatabaseEvent, City } from "../features/events/model/types";
import {
  deriveIncompleteEvents,
  UPCOMING_WINDOW_DAYS,
} from "../features/admin/model/overviewMetrics";
import {
  adminFormToPayload,
  buildAdminFormFromEvent,
  buildEmptyAdminForm,
} from "../features/admin/model/adminEventForm";
import type { AdminEventForm as AdminEventFormValues } from "../features/admin/model/adminEventForm";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminEventsTable from "../components/Admin/AdminEventsTable";
import AdminEventForm from "../components/Admin/AdminEventForm";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import "./AdminEventsPage.css";

type AdminEventsView =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; event: DatabaseEvent };
type PendingAction = { kind: "reject" | "delete"; event: DatabaseEvent } | null;
type StatusFilter = "all" | DatabaseEvent["status"];
type CityFilter = "all" | City;
type FlagFilter = "upcoming" | "incomplete" | null;

const PAGE_SIZE = 20;

export default function AdminEventsPage() {
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

  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<AdminEventsView>(() =>
    searchParams.get("new") === "1" ? { mode: "create" } : { mode: "list" }
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get("status");
    return value === "approved" || value === "pending" || value === "rejected" ? value : "all";
  });
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const [flag, setFlag] = useState<FlagFilter>(() => {
    const value = searchParams.get("flag");
    return value === "upcoming" || value === "incomplete" ? value : null;
  });
  const [page, setPage] = useState(1);

  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  // ?edit=<uuid> depends on events, which load asynchronously, so it can't
  // be resolved in the useState initializer above. Adjusted during render
  // (React's documented pattern for state derived from a changing external
  // value) rather than in an effect, which would cost an extra render pass.
  // `resolvedEditId` ensures this runs once per id — a match switches to
  // edit mode; no match (deleted, or not yet loaded) silently stays on the
  // list and is not retried once the query has settled.
  const editId = searchParams.get("edit");
  const [resolvedEditId, setResolvedEditId] = useState<string | null>(null);
  if (editId && editId !== resolvedEditId && queriedEvents) {
    setResolvedEditId(editId);
    const event = queriedEvents.find((candidate) => candidate.id === editId);
    if (event) setView({ mode: "edit", event });
  }

  const filteredEvents = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    const now = new Date();
    const upcomingWindowEnd = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const incompleteIds =
      flag === "incomplete"
        ? new Set(deriveIncompleteEvents(events, now).map(({ event }) => event.id))
        : null;

    return events.filter((event) => {
      const matchesSearch =
        trimmedSearch === "" ||
        event.title.toLowerCase().includes(trimmedSearch) ||
        (event.location ?? "").toLowerCase().includes(trimmedSearch);
      const matchesStatus = statusFilter === "all" || event.status === statusFilter;
      const matchesCity = cityFilter === "all" || event.city === cityFilter;
      const eventDate = new Date(event.event_date);
      const matchesFlag =
        flag === null
          ? true
          : flag === "upcoming"
            ? event.status === "approved" && eventDate >= now && eventDate <= upcomingWindowEnd
            : incompleteIds !== null && incompleteIds.has(event.id);
      return matchesSearch && matchesStatus && matchesCity && matchesFlag;
    });
  }, [events, search, statusFilter, cityFilter, flag]);

  const total = filteredEvents.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedEvents = filteredEvents.slice(pageStart, pageStart + PAGE_SIZE);
  const from = total === 0 ? 0 : pageStart + 1;
  const to = Math.min(pageStart + PAGE_SIZE, total);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const changeStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const changeCityFilter = (value: CityFilter) => {
    setCityFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCityFilter("all");
    setFlag(null);
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("status");
      next.delete("flag");
      return next;
    });
  };

  const busy = decidingId
    ? {
        id: decidingId,
        action: decidingStatus === "approved" ? ("approve" as const) : ("reject" as const),
      }
    : removingId
      ? { id: removingId, action: "delete" as const }
      : null;
  const errorId = decideErrorId ?? removeErrorId;
  const rowError = decideErrorId ? decideError : removeErrorId ? removeError : null;

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "reject") {
      decide({ id: pendingAction.event.id, status: "rejected" });
    } else {
      remove(pendingAction.event.id);
    }
    setPendingAction(null);
  };

  const submitForm = (form: AdminEventFormValues) => {
    const id = view.mode === "edit" ? view.event.id : null;
    save({ id, payload: adminFormToPayload(form) }, { onSuccess: () => setView({ mode: "list" }) });
  };

  const isPendingActionBusy =
    pendingAction?.kind === "reject"
      ? decidingId === pendingAction.event.id
      : pendingAction?.kind === "delete"
        ? removingId === pendingAction.event.id
        : false;

  if (view.mode !== "list") {
    const isEdit = view.mode === "edit";
    return (
      <AdminEventForm
        initial={isEdit ? buildAdminFormFromEvent(view.event) : buildEmptyAdminForm(city)}
        heading={isEdit ? "Edit event" : "New event"}
        submitLabel={isEdit ? "Save changes" : "Create event"}
        isSaving={isSaving}
        error={saveError}
        onSubmit={submitForm}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Events"
        description="Manage events appearing on the calendar"
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => setView({ mode: "create" })}
          >
            <Plus size={16} />
            New event
          </button>
        }
      />

      {isLoading && (
        <p role="status" className="admin-events-page__status">
          Loading events…
        </p>
      )}

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>Couldn't load events: {error}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="admin-card admin-events-page__empty">
          <h2>No events yet.</h2>
          <Link to="/calendar" className="admin-btn admin-btn--secondary">
            View calendar
          </Link>
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <>
          <div className="admin-card admin-events-page__filters">
            <div className="admin-field admin-events-page__search">
              <label htmlFor="admin-events-search">Search</label>
              <div className="admin-events-page__search-input">
                <Search size={16} />
                <input
                  id="admin-events-search"
                  type="text"
                  className="admin-input"
                  placeholder="Search events by name or venue..."
                  value={search}
                  onChange={(event) => changeSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="admin-field">
              <label htmlFor="admin-events-status">Status</label>
              <div className="admin-select-wrap">
                <select
                  id="admin-events-status"
                  className="admin-select"
                  value={statusFilter}
                  onChange={(event) => changeStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </div>

            <div className="admin-field">
              <label htmlFor="admin-events-city">City</label>
              <div className="admin-select-wrap">
                <select
                  id="admin-events-city"
                  className="admin-select"
                  value={cityFilter}
                  onChange={(event) => changeCityFilter(event.target.value as CityFilter)}
                >
                  <option value="all">All cities</option>
                  <option value="boston">Boston</option>
                  <option value="new-york-city">New York City</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {flag && (
            <div className="admin-chip admin-events-page__flag-chip">
              <span>{flag === "upcoming" ? "Next 30 days" : "Missing info"}</span>
              <button
                type="button"
                className="admin-events-page__flag-chip-dismiss"
                aria-label="Remove filter"
                onClick={() => {
                  setFlag(null);
                  setPage(1);
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("flag");
                    return next;
                  });
                }}
              >
                ×
              </button>
            </div>
          )}

          {total === 0 ? (
            <div className="admin-card admin-events-page__empty">
              <p>No events match these filters.</p>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="admin-card admin-events-page__table-card">
              <AdminEventsTable
                events={pagedEvents}
                onEdit={(event) => setView({ mode: "edit", event })}
                onApprove={(id) => decide({ id, status: "approved" })}
                onReject={(id) => {
                  const event = events.find((candidate) => candidate.id === id);
                  if (event) setPendingAction({ kind: "reject", event });
                }}
                onDelete={(id) => {
                  const event = events.find((candidate) => candidate.id === id);
                  if (event) setPendingAction({ kind: "delete", event });
                }}
                busy={busy}
                errorId={errorId}
                error={rowError}
              />

              <div className="admin-events-page__pagination">
                <p>
                  Showing {from} to {to} of {total} events
                </p>
                <div className="admin-events-page__pagination-controls">
                  <button
                    type="button"
                    className="admin-icon-btn"
                    aria-label="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {pageCount > 1 &&
                    Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={
                          pageNumber === currentPage
                            ? "admin-events-page__page-btn admin-events-page__page-btn--active"
                            : "admin-events-page__page-btn"
                        }
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="admin-icon-btn"
                    aria-label="Next page"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {pendingAction && (
        <AdminConfirmDialog
          title={pendingAction.kind === "reject" ? "Reject this event?" : "Delete this event?"}
          body={
            pendingAction.kind === "reject"
              ? `"${pendingAction.event.title}" will be hidden from the public calendar. You can approve it again later.`
              : `"${pendingAction.event.title}" will be permanently deleted. This cannot be undone.`
          }
          confirmLabel={pendingAction.kind === "reject" ? "Reject event" : "Delete event"}
          isBusy={isPendingActionBusy}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
