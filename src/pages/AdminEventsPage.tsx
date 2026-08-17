import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useCity } from "../contexts/useCity";
import { usePlatformSettings } from "../features/admin/hooks/usePlatformSettings";
import type { DatabaseEvent, City } from "../features/events/model/types";
import { findPotentialDuplicates } from "../features/admin/model/overviewMetrics";
import {
  applyView,
  applyFilters,
  applySort,
  defaultSortFor,
  viewCounts,
  CITY_LABEL,
  DANCE_STYLES,
  SOURCE_TYPE_LABEL,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  EVENT_VIEWS,
  type EventFilters,
  type EventView,
  type SortDir,
  type SortKey,
} from "../features/admin/model/eventsQuery";
import {
  adminFormToPayload,
  buildAdminFormFromEvent,
  buildEmptyAdminForm,
} from "../features/admin/model/adminEventForm";
import type { AdminEventForm as AdminEventFormValues } from "../features/admin/model/adminEventForm";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminViewTabs from "../components/Admin/AdminViewTabs";
import AdminEventsToolbar from "../components/Admin/AdminEventsToolbar";
import AdminEventsFilterDrawer from "../components/Admin/AdminEventsFilterDrawer";
import AdminEventsTable, { type RowAction } from "../components/Admin/AdminEventsTable";
import AdminPagination from "../components/Admin/AdminPagination";
import AdminEventForm from "../components/Admin/AdminEventForm";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminDuplicateEventDialog from "../components/Admin/AdminDuplicateEventDialog";
import "./AdminEventsPage.css";

type AdminEventsView =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; event: DatabaseEvent };
type PendingAction = {
  kind: "reject" | "cancel" | "archive" | "delete";
  event: DatabaseEvent;
} | null;

const VALID_VIEWS: EventView[] = [
  "all",
  "upcoming",
  "drafts",
  "pending",
  "published",
  "cancelled",
  "archived",
];
const VALID_STATUSES: DatabaseEvent["status"][] = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "archived",
];
const VALID_SORT_KEYS: SortKey[] = ["event_date", "created_at", "updated_at", "title"];
const VALID_SOURCES: DatabaseEvent["source_type"][] = [
  "admin",
  "user_submission",
  "organizer",
  "moderator",
  "imported",
];
const VALID_CITIES: City[] = ["boston", "new-york-city"];

const VIEW_LABEL: Record<EventView, string> = {
  all: "All Events",
  upcoming: "Upcoming",
  drafts: "Drafts",
  pending: "Pending Review",
  published: "Published",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  draft: "Draft",
  pending: "Pending Approval",
  approved: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};

// flag=upcoming normalizes to view=upcoming (Phase 2 back-compat); an
// explicit ?view= always wins. /admin/submissions is a dedicated route that
// defaults to the pending view.
function parseView(searchParams: URLSearchParams): EventView {
  const raw = searchParams.get("view");
  if (raw && VALID_VIEWS.includes(raw as EventView)) return raw as EventView;
  if (searchParams.get("flag") === "upcoming") return "upcoming";
  // /admin/submissions route — default to pending review view
  if (window.location.pathname === "/admin/submissions") return "pending";
  return "upcoming";
}

function parseFilters(searchParams: URLSearchParams): EventFilters {
  const statusParam = searchParams.get("status");
  const status = statusParam
    ? statusParam
        .split(",")
        .filter((value): value is DatabaseEvent["status"] =>
          VALID_STATUSES.includes(value as DatabaseEvent["status"])
        )
    : [];
  const source = searchParams.get("source");
  const city = searchParams.get("city");

  return {
    q: searchParams.get("q") ?? "",
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    status,
    organizer: searchParams.get("organizer"),
    venue: searchParams.get("venue"),
    city: city && VALID_CITIES.includes(city as City) ? (city as City) : null,
    style: searchParams.get("style"),
    source:
      source && VALID_SOURCES.includes(source as DatabaseEvent["source_type"])
        ? (source as DatabaseEvent["source_type"])
        : null,
    // Kept as the canonical param name for the quality filter so Phase 2's
    // ?flag=incomplete Overview link keeps working — flag=upcoming (view)
    // and flag=incomplete (this filter) are the only two values ever set.
    incompleteOnly: searchParams.get("flag") === "incomplete",
    submitter: searchParams.get("submitter"),
  };
}

function parseSort(searchParams: URLSearchParams, view: EventView): { key: SortKey; dir: SortDir } {
  const fallback = defaultSortFor(view);
  const key = searchParams.get("sort");
  const dir = searchParams.get("dir");
  return {
    key: key && VALID_SORT_KEYS.includes(key as SortKey) ? (key as SortKey) : fallback.key,
    dir: dir === "asc" || dir === "desc" ? dir : fallback.dir,
  };
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page"));
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

function parseSize(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("size"));
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

function formatShortDate(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export default function AdminEventsPage() {
  const { city } = useCity();
  const { settings: platformSettings, isLoading: platformSettingsLoading } = usePlatformSettings();
  const {
    events: queriedEvents,
    isLoading,
    error,
    refetch,
    changeStatus,
    changingStatusId,
    changeStatusErrorId,
    changeStatusError,
    save,
    isSaving,
    saveError,
    remove,
    removingId,
    removeErrorId,
    removeError,
    duplicate,
    isDuplicating,
    duplicateError,
  } = useAdminEvents();

  const [searchParams, setSearchParams] = useSearchParams();

  const [formView, setFormView] = useState<AdminEventsView>(() =>
    searchParams.get("new") === "1" ? { mode: "create" } : { mode: "list" }
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<DatabaseEvent | null>(null);
  const [lastRowAction, setLastRowAction] = useState<RowAction | null>(null);

  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  // ?edit=<uuid> depends on events, which load asynchronously, so it can't
  // be resolved in the useState initializer above. Adjusted during render
  // (React's documented pattern for state derived from a changing external
  // value) rather than in an effect, which would cost an extra render pass.
  // resolvedEditId ensures this runs once per id — a match switches to edit
  // mode; no match (deleted, or not yet loaded) silently stays on the list
  // and is not retried once the query has settled.
  const editId = searchParams.get("edit");
  const [resolvedEditId, setResolvedEditId] = useState<string | null>(null);
  if (editId && editId !== resolvedEditId && queriedEvents) {
    setResolvedEditId(editId);
    const event = queriedEvents.find((candidate) => candidate.id === editId);
    if (event) setFormView({ mode: "edit", event });
  }

  const { view, filters, sort, page, size, pagedEvents, total } = useMemo(() => {
    const now = new Date();
    const parsedView = parseView(searchParams);
    const parsedFilters = parseFilters(searchParams);
    const parsedSort = parseSort(searchParams, parsedView);
    const parsedPage = parsePage(searchParams);
    const parsedSize = parseSize(searchParams);

    const viewed = applyView(events, parsedView, now);
    const filtered = applyFilters(viewed, parsedFilters, now);
    const sorted = applySort(filtered, parsedSort.key, parsedSort.dir);
    const start = (parsedPage - 1) * parsedSize;

    return {
      view: parsedView,
      filters: parsedFilters,
      sort: parsedSort,
      page: parsedPage,
      size: parsedSize,
      pagedEvents: sorted.slice(start, start + parsedSize),
      total: sorted.length,
    };
  }, [events, searchParams]);

  const counts = useMemo(() => viewCounts(events, new Date()), [events]);
  const duplicateIds = useMemo(() => findPotentialDuplicates(events), [events]);

  const updateParams = (patch: Record<string, string | null>, resetPage = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      if (resetPage) next.delete("page");
      return next;
    });
  };

  const handleViewChange = (nextView: EventView) => {
    updateParams({ view: nextView, flag: filters.incompleteOnly ? "incomplete" : null });
  };

  const handleFiltersChange = (nextFilters: EventFilters) => {
    updateParams({
      q: nextFilters.q || null,
      from: nextFilters.from,
      to: nextFilters.to,
      status: nextFilters.status.length > 0 ? nextFilters.status.join(",") : null,
      organizer: nextFilters.organizer,
      venue: nextFilters.venue,
      city: nextFilters.city,
      style: nextFilters.style,
      source: nextFilters.source,
      flag: nextFilters.incompleteOnly ? "incomplete" : null,
      submitter: nextFilters.submitter,
    });
  };

  const clearAllFilters = () => {
    updateParams({
      q: null,
      from: null,
      to: null,
      status: null,
      organizer: null,
      venue: null,
      city: null,
      style: null,
      source: null,
      flag: null,
      submitter: null,
    });
  };

  const handleTableSortChange = (key: SortKey) => {
    const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : defaultSortFor(view).dir;
    updateParams({ sort: key, dir }, false);
  };

  const handleToolbarSortChange = (nextSort: { key: SortKey; dir: SortDir }) => {
    updateParams({ sort: nextSort.key, dir: nextSort.dir }, false);
  };

  const handlePageChange = (nextPage: number) => {
    updateParams({ page: String(nextPage) }, false);
  };

  const handleSizeChange = (nextSize: number) => {
    const firstVisibleIndex = (page - 1) * size;
    const nextPage = Math.floor(firstVisibleIndex / nextSize) + 1;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("size", String(nextSize));
      next.set("page", String(nextPage));
      return next;
    });
  };

  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * size;
  const from = total === 0 ? 0 : pageStart + 1;
  const to = Math.min(pageStart + size, total);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => updateParams({ q: null }) });
  if (filters.from || filters.to) {
    const label =
      filters.from && filters.to
        ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
        : filters.from
          ? `From ${formatShortDate(filters.from)}`
          : `Until ${formatShortDate(filters.to!)}`;
    chips.push({ key: "date", label, onRemove: () => updateParams({ from: null, to: null }) });
  }
  filters.status.forEach((status) => {
    chips.push({
      key: `status-${status}`,
      label: STATUS_LABEL[status],
      onRemove: () =>
        updateParams({ status: filters.status.filter((s) => s !== status).join(",") || null }),
    });
  });
  if (filters.organizer) {
    chips.push({
      key: "organizer",
      label: filters.organizer,
      onRemove: () => updateParams({ organizer: null }),
    });
  }
  if (filters.venue) {
    chips.push({
      key: "venue",
      label: filters.venue,
      onRemove: () => updateParams({ venue: null }),
    });
  }
  if (filters.submitter) {
    const needle = filters.submitter.toLowerCase();
    const matched = events.find(
      (event) =>
        event.submitter_id === filters.submitter || event.submitter_email?.toLowerCase() === needle
    );
    const matchedName = matched
      ? matched.submitter_id === null
        ? matched.submitter_name || "Guest Submitter"
        : matched.submitter_name || "this account"
      : null;
    chips.push({
      key: "submitter",
      label: matchedName ? `Submitted by ${matchedName}` : "Submitted by this account",
      onRemove: () => updateParams({ submitter: null }),
    });
  }
  if (filters.city) {
    chips.push({
      key: "city",
      label: CITY_LABEL[filters.city],
      onRemove: () => updateParams({ city: null }),
    });
  }
  if (filters.style) {
    const styleLabel =
      DANCE_STYLES.find((option) => option.value === filters.style)?.label ?? filters.style;
    chips.push({ key: "style", label: styleLabel, onRemove: () => updateParams({ style: null }) });
  }
  if (filters.source) {
    chips.push({
      key: "source",
      label: SOURCE_TYPE_LABEL[filters.source],
      onRemove: () => updateParams({ source: null }),
    });
  }
  if (filters.incompleteOnly) {
    chips.push({
      key: "incomplete",
      label: "Missing info",
      onRemove: () => updateParams({ flag: null }),
    });
  }

  const drawerFilterCount = [
    filters.organizer,
    filters.venue,
    filters.style,
    filters.city,
    filters.source,
  ].filter(Boolean).length;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const busy = changingStatusId
    ? { id: changingStatusId, action: lastRowAction ?? "publish" }
    : removingId
      ? { id: removingId, action: "delete" as const }
      : null;
  const errorId = changeStatusErrorId ?? removeErrorId;
  const rowError = changeStatusErrorId ? changeStatusError : removeErrorId ? removeError : null;

  const handleRowAction = (action: RowAction, event: DatabaseEvent) => {
    setLastRowAction(action);
    switch (action) {
      case "edit":
        setFormView({ mode: "edit", event });
        updateParams({ edit: event.id }, false);
        break;
      case "duplicate":
        setDuplicatingEvent(event);
        break;
      case "publish":
        changeStatus({ id: event.id, status: "approved" });
        break;
      case "unpublish":
      case "restore":
        changeStatus({ id: event.id, status: "draft" });
        break;
      case "reject":
        setPendingAction({ kind: "reject", event });
        break;
      case "cancel":
        setPendingAction({ kind: "cancel", event });
        break;
      case "archive":
        setPendingAction({ kind: "archive", event });
        break;
      case "delete":
        setPendingAction({ kind: "delete", event });
        break;
    }
  };

  const confirmPendingAction = (reason?: string) => {
    if (!pendingAction) return;
    switch (pendingAction.kind) {
      case "reject":
        changeStatus({ id: pendingAction.event.id, status: "rejected" });
        break;
      case "cancel":
        changeStatus({ id: pendingAction.event.id, status: "cancelled", reason });
        break;
      case "archive":
        changeStatus({ id: pendingAction.event.id, status: "archived" });
        break;
      case "delete":
        remove(pendingAction.event.id);
        break;
    }
    setPendingAction(null);
  };

  const isPendingActionBusy =
    pendingAction?.kind === "delete"
      ? removingId === pendingAction.event.id
      : changingStatusId === pendingAction?.event.id;

  const submitForm = (form: AdminEventFormValues) => {
    const id = formView.mode === "edit" ? formView.event.id : null;
    save(
      { id, payload: adminFormToPayload(form) },
      { onSuccess: () => setFormView({ mode: "list" }) }
    );
  };

  if (formView.mode !== "list") {
    const isEdit = formView.mode === "edit";
    if (!isEdit && platformSettingsLoading) {
      return (
        <section className="admin-page" aria-busy="true">
          <div className="admin-skeleton" />
        </section>
      );
    }
    return (
      <AdminEventForm
        initial={
          isEdit
            ? buildAdminFormFromEvent(formView.event)
            : buildEmptyAdminForm(platformSettings?.default_city ?? city)
        }
        initialTaxonomyTerms={isEdit ? formView.event.taxonomy_terms : []}
        heading={isEdit ? "Edit event" : "New event"}
        submitLabel={isEdit ? "Save changes" : "Create event"}
        isSaving={isSaving}
        error={saveError}
        onSubmit={submitForm}
        onCancel={() => setFormView({ mode: "list" })}
      />
    );
  }

  const noFiltersActive = chips.length === 0;
  const emptyDb = !isLoading && !error && events.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Events"
        description="Manage events appearing on the SalsaSegura calendar."
        actions={
          <>
            <Link to="/admin/events/import" className="admin-btn admin-btn--secondary">
              <Upload size={16} />
              Import Events
            </Link>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setFormView({ mode: "create" })}
            >
              <Plus size={16} />
              Create Event
            </button>
          </>
        }
      />

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load events.</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <AdminViewTabs
            views={EVENT_VIEWS}
            active={view}
            counts={counts}
            panelId="admin-events-tabpanel"
            ariaLabel="Event views"
            selectId="admin-view-tabs-select"
            selectLabel="Event view"
            onChange={handleViewChange}
          />

          <div className="admin-card admin-events-page__toolbar-card">
            <AdminEventsToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              sort={sort}
              onSortChange={handleToolbarSortChange}
              drawerFilterCount={drawerFilterCount}
              onOpenDrawer={() => setDrawerOpen(true)}
            />

            {chips.length > 0 && (
              <div className="admin-events-page__chips">
                {chips.map((chip) => (
                  <div key={chip.key} className="admin-chip admin-filter-chip">
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      className="admin-filter-chip-dismiss"
                      aria-label={`Remove ${chip.label} filter`}
                      onClick={chip.onRemove}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {chips.length >= 2 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost admin-events-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p role="status" className="admin-events-page__result-count">
            {total} event{total === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-events-page__table-card"
            id="admin-events-tabpanel"
            role="tabpanel"
            aria-labelledby={`admin-view-tab-${view}`}
          >
            {isLoading ? (
              <div className="admin-events-page__skeleton" aria-busy="true">
                <p role="status" className="admin-events-page__status">
                  Loading events…
                </p>
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="admin-events-page__skeleton-row" aria-hidden="true">
                    <span className="admin-skeleton admin-events-page__skeleton-thumb" />
                    <span className="admin-events-page__skeleton-lines">
                      <span className="admin-skeleton admin-events-page__skeleton-line" />
                      <span className="admin-skeleton admin-events-page__skeleton-line admin-events-page__skeleton-line--short" />
                    </span>
                    <span className="admin-skeleton admin-events-page__skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-events-page__empty">
                <h2>No events yet</h2>
                <p>Create the first SalsaSegura event.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => setFormView({ mode: "create" })}
                >
                  <Plus size={16} />
                  Create Event
                </button>
              </div>
            ) : total === 0 && !noFiltersActive ? (
              <div className="admin-events-page__empty">
                <h2>No events match your filters.</h2>
                <p>Try adjusting your filters or clearing them.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : total === 0 && view === "upcoming" ? (
              <div className="admin-events-page__empty">
                <h2>No upcoming events</h2>
                <p>Nothing is scheduled from today onward.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => setFormView({ mode: "create" })}
                >
                  <Plus size={16} />
                  Create Event
                </button>
              </div>
            ) : total === 0 && view === "pending" ? (
              <div className="admin-events-page__empty">
                <h2>Nothing waiting for review</h2>
                <p>Every submission has been handled.</p>
              </div>
            ) : total === 0 ? (
              <div className="admin-events-page__empty">
                <h2>No {VIEW_LABEL[view]} events</h2>
              </div>
            ) : (
              <>
                <AdminEventsTable
                  events={pagedEvents}
                  duplicateIds={duplicateIds}
                  sort={sort}
                  onSortChange={handleTableSortChange}
                  onAction={handleRowAction}
                  busy={busy}
                  errorId={errorId}
                  error={rowError}
                />
                <AdminPagination
                  page={currentPage}
                  pageCount={pageCount}
                  total={total}
                  from={from}
                  to={to}
                  size={size}
                  onPageChange={handlePageChange}
                  onSizeChange={handleSizeChange}
                />
              </>
            )}
          </div>
        </>
      )}

      <AdminEventsFilterDrawer
        open={drawerOpen}
        events={events}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setDrawerOpen(false)}
      />

      {pendingAction && (
        <AdminConfirmDialog
          title={
            pendingAction.kind === "reject"
              ? "Reject this event?"
              : pendingAction.kind === "cancel"
                ? "Cancel this event?"
                : pendingAction.kind === "archive"
                  ? "Archive this event?"
                  : "Delete this event?"
          }
          body={
            pendingAction.kind === "reject"
              ? `"${pendingAction.event.title}" will be hidden from the public calendar. You can approve it again later.`
              : pendingAction.kind === "cancel"
                ? `"${pendingAction.event.title}" will be marked cancelled. It stays visible in the admin list and is removed from the public calendar.`
                : pendingAction.kind === "archive"
                  ? `"${pendingAction.event.title}" will be moved to Archived and hidden from the main event list. You can restore it later.`
                  : `"${pendingAction.event.title}" will be permanently deleted. This cannot be undone.`
          }
          confirmLabel={
            pendingAction.kind === "reject"
              ? "Reject event"
              : pendingAction.kind === "cancel"
                ? "Cancel event"
                : pendingAction.kind === "archive"
                  ? "Archive event"
                  : "Delete event"
          }
          tone={pendingAction.kind === "archive" ? "neutral" : "danger"}
          reasonField={
            pendingAction.kind === "cancel"
              ? { label: "Reason (optional)", required: false }
              : undefined
          }
          isBusy={isPendingActionBusy}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {duplicatingEvent && (
        <AdminDuplicateEventDialog
          event={duplicatingEvent}
          isBusy={isDuplicating}
          error={duplicateError}
          onConfirm={(input) => {
            duplicate(
              { source: duplicatingEvent, input },
              { onSuccess: () => setDuplicatingEvent(null) }
            );
          }}
          onCancel={() => setDuplicatingEvent(null)}
        />
      )}
    </>
  );
}
