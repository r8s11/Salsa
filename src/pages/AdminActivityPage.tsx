import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminActivityToolbar from "../components/Admin/AdminActivityToolbar";
import AdminActivityFilterDrawer from "../components/Admin/AdminActivityFilterDrawer";
import AdminActivityTable from "../components/Admin/AdminActivityTable";
import AdminPagination from "../components/Admin/AdminPagination";
import { useAdminActivity } from "../hooks/useAdminActivity";
import {
  ACTIVITY_VIEWS,
  CATEGORY_LABEL,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  activityViewCounts,
  type ActivityAuditLog,
  type ActivityView,
  type ActivitySortKey,
  type ActivityFilters,
  type ActivityCategory,
} from "../features/admin/model/auditActivityQuery";
import "./AdminActivityPage.css";

// ---- URL param parsing (matches AdminVenuesPage / AdminEventsPage shape) ----

function parseView(searchParams: URLSearchParams): ActivityView {
  const raw = searchParams.get("view");
  return ACTIVITY_VIEWS.some((v) => v.view === raw) ? (raw as ActivityView) : "all";
}

function parseFilters(searchParams: URLSearchParams): ActivityFilters {
  const q = searchParams.get("q") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const categoryRaw = searchParams.get("category");
  const category = categoryRaw ? [categoryRaw] as ActivityCategory[] : [];
  const actionRaw = searchParams.get("action");
  const action = actionRaw ? [actionRaw] : [];
  const actor = searchParams.get("actor");
  const targetTypeRaw = searchParams.get("target_type");
  const targetType = targetTypeRaw ? [targetTypeRaw] : [];

  return { q, from, to, category, action, actor, targetType };
}

function parseSort(searchParams: URLSearchParams): ActivitySortKey {
  const raw = searchParams.get("sort");
  return raw === "oldest" ? "oldest" : "newest";
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

export default function AdminActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeView = parseView(searchParams);
  const sort = parseSort(searchParams);
  const page = parsePage(searchParams);
  const size = parseSize(searchParams);
  const filters = parseFilters(searchParams);

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

  const handleViewChange = (nextView: ActivityView) => updateParams({ view: nextView });
  const handleSortChange = (nextSort: ActivitySortKey) => updateParams({ sort: nextSort });
  const handlePageChange = (nextPage: number) => updateParams({ page: String(nextPage) }, false);
  const handleSizeChange = (nextSize: number) => {
    const firstVisibleIndex = (page - 1) * size;
    const nextPage = Math.floor(firstVisibleIndex / nextSize) + 1;
    updateParams({ size: String(nextSize), page: String(nextPage) }, false);
  };

  const drawerFilterCount =
    (filters.q ? 1 : 0) +
    filters.category.length +
    filters.action.length +
    filters.targetType.length +
    (filters.actor ? 1 : 0);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => updateParams({ q: null }) });
  if (filters.category.length > 0) {
    chips.push({
      key: "category",
      label: filters.category.map((c) => CATEGORY_LABEL[c]).join(", "),
      onRemove: () => updateParams({ category: null }),
    });
  }
  if (filters.action.length > 0) {
    chips.push({
      key: "action",
      label: `${filters.action.length} action${filters.action.length > 1 ? "s" : ""}`,
      onRemove: () => updateParams({ action: null }),
    });
  }
  if (filters.targetType.length > 0) {
    chips.push({
      key: "targetType",
      label: `${filters.targetType.length} type${filters.targetType.length > 1 ? "s" : ""}`,
      onRemove: () => updateParams({ target_type: null }),
    });
  }
  if (filters.actor)
    chips.push({ key: "actor", label: `Actor ${filters.actor.slice(0, 8)}`, onRemove: () => updateParams({ actor: null }) });
  if (filters.from)
    chips.push({ key: "from", label: `From ${filters.from}`, onRemove: () => updateParams({ from: null }) });
  if (filters.to)
    chips.push({ key: "to", label: `To ${filters.to}`, onRemove: () => updateParams({ to: null }) });

  const clearAllFilters = () => {
    updateParams({
      q: null,
      from: null,
      to: null,
      category: null,
      action: null,
      actor: null,
      target_type: null,
      view: null,
    });
  };

  const handleRowAction = (entry: ActivityAuditLog) => {
    navigate(`/admin/activity/${entry.id}`);
  };

  const targetDisplayMap: Record<string, string> = {};

  const isError = !!error;
  const emptyDb = !isLoading && !isError && currentEntries.length === 0;

  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * size;
  const fromIdx = total === 0 ? 0 : pageStart + 1;
  const toIdx = Math.min(pageStart + size, total);

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
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      )}

      {!isError && (
        <>
          <AdminActivityToolbar
            view={activeView}
            onViewChange={handleViewChange}
            sort={sort}
            onSortChange={handleSortChange}
            filters={filters}
            onFiltersChange={(next) => {
              updateParams({
                q: next.q || null,
                from: next.from,
                to: next.to,
                category: next.category[0] ?? null,
                action: next.action[0] ?? null,
                actor: next.actor ?? null,
                target_type: next.targetType[0] ?? null,
              });
            }}
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
                  <div
                    key={index}
                    className="admin-activity-page__skeleton-row"
                    aria-hidden="true"
                  >
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
                  onPageChange={handlePageChange}
                  onSizeChange={handleSizeChange}
                />
              </>
            )}
          </div>
        </>
      )}

      <AdminActivityFilterDrawer
        open={drawerOpen}
        filters={filters}
        onFiltersChange={(next) => {
          updateParams({
            q: next.q || null,
            from: next.from,
            to: next.to,
            category: next.category[0] ?? null,
            action: next.action[0] ?? null,
            actor: next.actor ?? null,
            target_type: next.targetType[0] ?? null,
          });
        }}
        onApply={() => setDrawerOpen(false)}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
