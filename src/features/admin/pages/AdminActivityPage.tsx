import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminActivityToolbar from "../components/activity/AdminActivityToolbar";
import AdminActivityFilterDrawer from "../components/activity/AdminActivityFilterDrawer";
import AdminActivityTable from "../components/activity/AdminActivityTable";
import AdminPagination from "../components/common/AdminPagination";
import { useAdminActivity } from "../hooks/useAdminActivity";
import { useListState, usePageWindow } from "../hooks/useListState";
import {
  ACTIVITY_LIST,
  CATEGORY_LABEL,
  activityViewCounts,
  type ActivityAuditLog,
  type ActivityFilters,
} from "../model/auditActivityQuery";
import "./AdminActivityPage.css";

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export default function AdminActivityPage() {
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = useListState(ACTIVITY_LIST);
  const { view: activeView, filters, sort, page, size } = list.state;

  // Build RPC params based on URL filters
  const rpcParams = useMemo(
    () => ({
      limit: size,
      offset: (page - 1) * size,
      q: filters.q || null,
      category: filters.category.length > 0 ? (filters.category as string[]) : null,
      action: filters.action.length > 0 ? filters.action : null,
      actor_id: filters.actor,
      entity_type: null,
      from: filters.from ? new Date(filters.from).toISOString() : null,
      to: filters.to ? new Date(filters.to).toISOString() : null,
    }),
    [filters, size, page]
  );

  const { entries, total, isLoading, error, refetch } = useAdminActivity(rpcParams);
  const currentEntries = useMemo(() => entries ?? [], [entries]);

  // Server-paged: the requested page drives the RPC offset; once the total
  // is known, an out-of-range page is clamped and refetched.
  const pageBounds = usePageWindow(list, isLoading || error ? null : total);
  const { page: currentPage, pageCount, from: fromIdx, to: toIdx } = pageBounds;

  const handleFiltersChange = (nextFilters: ActivityFilters) => list.change({ filters: nextFilters });

  const drawerFilterCount =
    (filters.q ? 1 : 0) +
    filters.category.length +
    filters.action.length +
    filters.targetType.length +
    (filters.actor ? 1 : 0);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: "q",
      label: `"${filters.q}"`,
      onRemove: () => handleFiltersChange({ ...filters, q: "" }),
    });
  if (filters.category.length > 0) {
    chips.push({
      key: "category",
      label: filters.category.map((c) => CATEGORY_LABEL[c]).join(", "),
      onRemove: () => handleFiltersChange({ ...filters, category: [] }),
    });
  }
  if (filters.action.length > 0) {
    chips.push({
      key: "action",
      label: `${filters.action.length} action${filters.action.length > 1 ? "s" : ""}`,
      onRemove: () => handleFiltersChange({ ...filters, action: [] }),
    });
  }
  if (filters.targetType.length > 0) {
    chips.push({
      key: "targetType",
      label: `${filters.targetType.length} type${filters.targetType.length > 1 ? "s" : ""}`,
      onRemove: () => handleFiltersChange({ ...filters, targetType: [] }),
    });
  }
  if (filters.actor)
    chips.push({
      key: "actor",
      label: `Actor ${filters.actor.slice(0, 8)}`,
      onRemove: () => handleFiltersChange({ ...filters, actor: null }),
    });
  if (filters.from)
    chips.push({
      key: "from",
      label: `From ${filters.from}`,
      onRemove: () => handleFiltersChange({ ...filters, from: null }),
    });
  if (filters.to)
    chips.push({
      key: "to",
      label: `To ${filters.to}`,
      onRemove: () => handleFiltersChange({ ...filters, to: null }),
    });

  const clearAllFilters = () =>
    list.change({
      view: "all",
      filters: { q: "", from: null, to: null, category: [], action: [], actor: null, targetType: [] },
    });

  const handleRowAction = (entry: ActivityAuditLog) => {
    navigate(`/admin/activity/${entry.id}`);
  };

  const targetDisplayMap: Record<string, string> = {};

  const isError = !!error;
  const emptyDb = !isLoading && !isError && currentEntries.length === 0;

  // Preset counts — server-paginated, so these approximate from the entries
  // on the current page/filter response rather than the full table.
  const presetCounts = useMemo(
    () => activityViewCounts(currentEntries, filters),
    [currentEntries, filters]
  );

  return (
    <>
      <AdminPageHeader
        title="Activity"
        description="Chronological record of administrative and moderation actions."
      />

      <p role="status" className="admin-visually-hidden">
        {isLoading ? "Loading activity…" : `${total} activity entries`}
      </p>

      {!isLoading && isError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load activity.</p>
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
          <AdminActivityToolbar
            view={activeView}
            onViewChange={(nextView) => list.change({ view: nextView })}
            sort={sort}
            onSortChange={(nextSort) => list.change({ sort: nextSort })}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            drawerFilterCount={drawerFilterCount}
            onOpenDrawer={() => setDrawerOpen(true)}
            counts={presetCounts}
          />

          <div className="admin-card admin-activity-page__toolbar-card">
            {chips.length > 0 && (
              <div className="admin-activity-page__chips">
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
                    className="admin-btn admin-btn--ghost admin-activity-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="admin-activity-page__result-count">
            {total} activity entr{total === 1 ? "y" : "ies"}
          </p>

          <div
            className="admin-card admin-activity-page__table-card"
            id="admin-activity-tabpanel"
            role="region"
            aria-label="Activity list"
          >
            {isLoading ? (
              <div className="admin-activity-page__skeleton" aria-busy="true">
                <p role="status" className="admin-activity-page__status">
                  Loading activity…
                </p>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="admin-activity-page__skeleton-row" aria-hidden="true">
                    <span className="admin-skeleton admin-activity-page__skeleton-line" />
                    <span className="admin-skeleton admin-activity-page__skeleton-line admin-activity-page__skeleton-line--short" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-activity-page__empty">
                <h2>No activity yet.</h2>
                <p>No administrative actions have been logged.</p>
              </div>
            ) : (
              <>
                <AdminActivityTable
                  entries={currentEntries}
                  targetDisplayMap={targetDisplayMap}
                  onViewDetail={handleRowAction}
                />
                <AdminPagination
                  page={currentPage}
                  pageCount={pageCount}
                  total={total}
                  from={fromIdx}
                  to={toIdx}
                  size={size}
                  onPageChange={(nextPage) => list.change({ page: nextPage })}
                  onSizeChange={(nextSize) => list.change({ size: nextSize })}
                />
              </>
            )}
          </div>
        </>
      )}

      <AdminActivityFilterDrawer
        open={drawerOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={() => setDrawerOpen(false)}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
