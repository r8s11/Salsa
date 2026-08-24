import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminVenues } from "../features/admin/hooks/useAdminVenues";
import {
  VENUE_VIEWS,
  VENUE_SORT_OPTIONS,
  applyVenueView,
  applyVenueFilters,
  applyVenueSort,
  venueViewCounts,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  type VenueView,
  type VenueFilters,
  type VenueSort,
  type VenueStatus,
  type VenueRow,
  type VenueAction,
} from "../features/admin/model/venuesQuery";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminVenuesToolbar from "../components/Admin/AdminVenuesToolbar";
import AdminVenuesFilterDrawer from "../components/Admin/AdminVenuesFilterDrawer";
import AdminVenuesTable from "../components/Admin/AdminVenuesTable";
import AdminPagination from "../components/Admin/AdminPagination";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import type { ActionMenuItem } from "../components/Admin/AdminActionMenu";
import "./AdminVenuesPage.css";

const VALID_VIEWS = VENUE_VIEWS.map((entry) => entry.view);
const VALID_SORT_OPTIONS = VENUE_SORT_OPTIONS;

function parseView(searchParams: URLSearchParams): VenueView {
  const raw = searchParams.get("view");
  return VALID_VIEWS.includes(raw as VenueView) ? (raw as VenueView) : "all";
}

function parseFilters(searchParams: URLSearchParams): VenueFilters {
  const q = searchParams.get("q") ?? "";
  const city = searchParams.get("city") ? [searchParams.get("city")!] : [];
  const state = searchParams.get("state") ? [searchParams.get("state")!] : [];
  const statusRaw = searchParams.get("status");
  const status = statusRaw ? ([statusRaw] as VenueStatus[]) : [];
  const hasUpcoming = searchParams.get("has_upcoming");
  return {
    q,
    city,
    state,
    status,
    has_upcoming: hasUpcoming ? hasUpcoming === "true" : null,
  };
}

function parseSort(searchParams: URLSearchParams): VenueSort {
  const raw = searchParams.get("sort");
  const option = VALID_SORT_OPTIONS.find((o) => o.value === raw);
  if (option) return { key: option.key, dir: option.dir };
  return { key: "name", dir: "asc" };
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page"));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

function parseSize(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("size"));
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

type PendingAction = { kind: "archive"; venue: VenueRow } | null;

export default function AdminVenuesPage() {
  const {
    venues: queriedVenues,
    isLoading,
    error,
    refetch,
    archive: archiveVenue,
    isArchiving,
    archiveError,
  } = useAdminVenues();

  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [announcement, setAnnouncement] = useState("");

  const venues = useMemo(() => queriedVenues ?? [], [queriedVenues]);

  const { view, filters, sort, page, size, pagedVenues, total } = useMemo(() => {
    const parsedView = parseView(searchParams);
    const parsedFilters = parseFilters(searchParams);
    const parsedSort = parseSort(searchParams);
    const parsedPage = parsePage(searchParams);
    const parsedSize = parseSize(searchParams);

    // Same pipeline as AdminOrganizerRequestsPage: applyView → applyFilters → sort
    const viewed = applyVenueView(venues, parsedView);
    const filtered = applyVenueFilters(viewed, parsedFilters);
    const sorted = applyVenueSort(filtered, parsedSort.key, parsedSort.dir);

    const start = (parsedPage - 1) * parsedSize;

    return {
      view: parsedView,
      filters: parsedFilters,
      sort: parsedSort,
      page: parsedPage,
      size: parsedSize,
      pagedVenues: sorted.slice(start, start + parsedSize),
      total: sorted.length,
    };
  }, [venues, searchParams]);

  const counts = useMemo(() => venueViewCounts(venues), [venues]);

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

  const handleViewChange = (nextView: VenueView) => {
    updateParams({ view: nextView });
  };

  const handleFiltersChange = (nextFilters: VenueFilters) => {
    updateParams({
      q: nextFilters.q || null,
      city: nextFilters.city[0] ?? null,
      state: nextFilters.state[0] ?? null,
      status: nextFilters.status[0] ?? null,
      has_upcoming: nextFilters.has_upcoming === null ? null : String(nextFilters.has_upcoming),
    });
  };

  const clearAllFilters = () => {
    updateParams({
      q: null,
      city: null,
      state: null,
      status: null,
      has_upcoming: null,
      view: "all",
    });
  };

  const handleToolbarSortChange = (nextSort: VenueSort) => {
    const option = VENUE_SORT_OPTIONS.find((o) => o.key === nextSort.key && o.dir === nextSort.dir);
    updateParams({ sort: option?.value ?? null }, false);
  };

  const handleTableSortChange = (key: string) => {
    const dir: "asc" | "desc" = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "desc";
    const option = VENUE_SORT_OPTIONS.find((o) => o.key === key && o.dir === dir);
    updateParams({ sort: option?.value ?? null }, false);
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

  const drawerFilterCount =
    (filters.q ? 1 : 0) +
    filters.city.length +
    filters.state.length +
    filters.status.length +
    (filters.has_upcoming !== null ? 1 : 0);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => updateParams({ q: null }) });
  if (filters.status.length > 0) {
    chips.push({
      key: "status",
      label: filters.status
        .map((s) => {
          const entry = VENUE_VIEWS.find((o) => o.view === s);
          return entry ? entry.label : s;
        })
        .join(", "),
      onRemove: () => updateParams({ status: null }),
    });
  }
  if (filters.city.length > 0) {
    chips.push({
      key: "city",
      label: filters.city.join(", "),
      onRemove: () => updateParams({ city: null }),
    });
  }
  if (filters.state.length > 0) {
    chips.push({
      key: "state",
      label: filters.state.join(", "),
      onRemove: () => updateParams({ state: null }),
    });
  }
  if (filters.has_upcoming !== null) {
    chips.push({
      key: "has_upcoming",
      label: filters.has_upcoming ? "Has upcoming events" : "No upcoming events",
      onRemove: () => updateParams({ has_upcoming: null }),
    });
  }

  const busy = isArchiving
    ? { id: pendingAction?.venue?.id ?? "", action: "archive" as VenueAction }
    : null;

  const handleRowAction = (action: VenueAction, target: VenueRow) => {
    if (action === "view") {
      window.location.href = `/admin/venues/${target.id}`;
    } else if (action === "archive") {
      setPendingAction({ kind: "archive", venue: target });
    }
  };

  const closeDialog = () => setPendingAction(null);

  const isError = !!error;
  const emptyDb = !isLoading && !isError && venues.length === 0;
  const noFiltersActive = chips.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Venues"
        description="Manage venue records. Archived venues don't appear in event submission forms."
      />

      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      {!isLoading && isError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load venues.</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Try Again
          </button>
        </div>
      )}

      {!isError && (
        <>
          <AdminVenuesToolbar
            view={view}
            onViewChange={handleViewChange}
            counts={counts}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            sort={sort}
            onSortChange={handleToolbarSortChange}
            drawerFilterCount={drawerFilterCount}
            onOpenDrawer={() => setDrawerOpen(true)}
          />

          <div className="admin-card admin-venues-page__toolbar-card">
            {chips.length > 0 && (
              <div className="admin-venues-page__chips">
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
                {chips.length >= 1 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost admin-venues-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p role="status" className="admin-venues-page__result-count">
            {total} venue{total === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-venues-page__table-card"
            id="admin-venues-tabpanel"
            role="region"
            aria-label="Venue list"
          >
            {isLoading ? (
              <div className="admin-venues-page__skeleton" aria-busy="true">
                <p role="status" className="admin-venues-page__status">
                  Loading venues…
                </p>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="admin-venues-page__skeleton-row" aria-hidden="true">
                    <span className="admin-skeleton admin-venues-page__skeleton-avatar" />
                    <span className="admin-venues-page__skeleton-lines">
                      <span className="admin-skeleton admin-venues-page__skeleton-line" />
                      <span className="admin-skeleton admin-venues-page__skeleton-line admin-venues-page__skeleton-line--short" />
                    </span>
                    <span className="admin-skeleton admin-venues-page__skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-venues-page__empty">
                <h2>No venues</h2>
                <p>No venue records have been created yet.</p>
              </div>
            ) : total === 0 && !noFiltersActive ? (
              <div className="admin-venues-page__empty">
                <h2>No venues match these filters.</h2>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <AdminVenuesTable
                  venues={pagedVenues}
                  sort={sort}
                  onSortChange={handleTableSortChange}
                  onAction={handleRowAction}
                  busy={busy}
                  errorId={null}
                  error={null}
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

      <AdminVenuesFilterDrawer
        isOpen={drawerOpen}
        filters={filters}
        onChange={(next) => {
          // onChange updates the live preview; onApply persists to URL.
          handleFiltersChange(next);
        }}
        onApply={() => {
          setDrawerOpen(false);
        }}
        onClear={() => {
          const empty: VenueFilters = {
            q: "",
            city: [],
            state: [],
            status: [],
            has_upcoming: null,
          };
          handleFiltersChange(empty);
        }}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Quick-archive confirmation */}
      {pendingAction?.kind === "archive" && (
        <AdminConfirmDialog
          title={`Archive ${pendingAction.venue.name}?`}
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
            archiveVenue(pendingAction.venue.id);
            setPendingAction(null);
            setAnnouncement("Venue archived.");
          }}
          onCancel={closeDialog}
        />
      )}
    </>
  );
}

export type { VenueView, VenueSort, VenueStatus, VenueRow, VenueAction, ActionMenuItem };
