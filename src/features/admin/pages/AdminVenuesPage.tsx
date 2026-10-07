import { useMemo, useState } from "react";
import { useAdminVenues } from "../hooks/useAdminVenues";
import { useListState, usePageWindow } from "../hooks/useListState";
import {
  VENUE_VIEWS,
  VENUES_LIST,
  applyVenueView,
  applyVenueFilters,
  applyVenueSort,
  venueViewCounts,
  type VenueView,
  type VenueFilters,
  type VenueSort,
  type VenueStatus,
  type VenueRow,
  type VenueAction,
} from "../model/venuesQuery";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminVenuesToolbar from "../components/venues/AdminVenuesToolbar";
import AdminVenuesFilterDrawer from "../components/venues/AdminVenuesFilterDrawer";
import AdminVenuesTable from "../components/venues/AdminVenuesTable";
import AdminPagination from "../components/common/AdminPagination";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import type { ActionMenuItem } from "../components/common/AdminActionMenu";
import "./AdminVenuesPage.css";

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [announcement, setAnnouncement] = useState("");

  const venues = useMemo(() => queriedVenues ?? [], [queriedVenues]);

  const list = useListState(VENUES_LIST);
  const { view, filters, sort, size } = list.state;
  const sorted = useMemo(
    () => applyVenueSort(applyVenueFilters(applyVenueView(venues, view), filters), sort.key, sort.dir),
    [venues, view, filters, sort]
  );
  const total = sorted.length;
  const pageBounds = usePageWindow(list, queriedVenues ? total : null);
  const pagedVenues = sorted.slice(pageBounds.offset, pageBounds.offset + size);
  const { page: currentPage, pageCount, from, to } = pageBounds;

  const counts = useMemo(() => venueViewCounts(venues), [venues]);

  const handleFiltersChange = (nextFilters: VenueFilters) => list.change({ filters: nextFilters });

  const clearAllFilters = () =>
    list.change({
      view: "all",
      filters: { q: "", city: [], state: [], status: [], has_upcoming: null },
    });

  const handleTableSortChange = (key: string) => {
    const dir: "asc" | "desc" = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "desc";
    list.change({ sort: { key: key as VenueSort["key"], dir } });
  };

  const drawerFilterCount =
    (filters.q ? 1 : 0) +
    filters.city.length +
    filters.state.length +
    filters.status.length +
    (filters.has_upcoming !== null ? 1 : 0);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: "q",
      label: `"${filters.q}"`,
      onRemove: () => handleFiltersChange({ ...filters, q: "" }),
    });
  if (filters.status.length > 0) {
    chips.push({
      key: "status",
      label: filters.status
        .map((s) => {
          const entry = VENUE_VIEWS.find((o) => o.view === s);
          return entry ? entry.label : s;
        })
        .join(", "),
      onRemove: () => handleFiltersChange({ ...filters, status: [] }),
    });
  }
  if (filters.city.length > 0) {
    chips.push({
      key: "city",
      label: filters.city.join(", "),
      onRemove: () => handleFiltersChange({ ...filters, city: [] }),
    });
  }
  if (filters.state.length > 0) {
    chips.push({
      key: "state",
      label: filters.state.join(", "),
      onRemove: () => handleFiltersChange({ ...filters, state: [] }),
    });
  }
  if (filters.has_upcoming !== null) {
    chips.push({
      key: "has_upcoming",
      label: filters.has_upcoming ? "Has upcoming events" : "No upcoming events",
      onRemove: () => handleFiltersChange({ ...filters, has_upcoming: null }),
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
            onViewChange={(nextView) => list.change({ view: nextView })}
            counts={counts}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            sort={sort}
            onSortChange={(nextSort) => list.change({ sort: nextSort })}
            drawerFilterCount={drawerFilterCount}
            onOpenDrawer={() => setDrawerOpen(true)}
          />

          {chips.length > 0 && (
            <div className="admin-card admin-venues-page__toolbar-card">
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
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-venues-page__clear-all"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

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
                  onPageChange={(nextPage) => list.change({ page: nextPage })}
                  onSizeChange={(nextSize) => list.change({ size: nextSize })}
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
