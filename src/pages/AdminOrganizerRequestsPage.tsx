import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOrganizerRequests } from "../features/admin/hooks/useOrganizerRequests";
import {
  REQUEST_VIEWS,
  REQUEST_SORT_OPTIONS,
  applyRequestFilters,
  applyRequestView,
  applyRequestSort,
  requestViewCounts,
  type RequestView,
  type RequestFilters,
  type RequestSort,
  type RequestStatus,
  type RequestRowAction,
  type OrganizerRequestRow,
} from "../features/admin/model/organizerRequestsQuery";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../features/admin/model/eventsQuery";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminViewTabs from "../components/Admin/AdminViewTabs";
import AdminOrganizerRequestsToolbar from "../components/Admin/AdminOrganizerRequestsToolbar";
import AdminOrganizerRequestsFilterDrawer from "../components/Admin/AdminOrganizerRequestsFilterDrawer";
import AdminOrganizerRequestsTable from "../components/Admin/AdminOrganizerRequestsTable";
import AdminPagination from "../components/Admin/AdminPagination";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminRejectOrganizerDialog from "../components/Admin/AdminRejectOrganizerDialog";
import type { ActionMenuItem } from "../components/Admin/AdminActionMenu";
import "./AdminOrganizerRequestsPage.css";

/** Pending action + the request it applies to, so the dialog knows the target. */
type PendingAction =
  | { kind: "approve"; request: OrganizerRequestRow }
  | { kind: "reject"; request: OrganizerRequestRow }
  | null;

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const VALID_VIEWS = REQUEST_VIEWS.map((entry) => entry.view);
const VALID_SORT_OPTIONS = REQUEST_SORT_OPTIONS;

function parseView(searchParams: URLSearchParams): RequestView {
  const raw = searchParams.get("view");
  return VALID_VIEWS.includes(raw as RequestView) ? (raw as RequestView) : "pending";
}

function parseFilters(searchParams: URLSearchParams): RequestFilters {
  return {
    q: searchParams.get("q") ?? "",
    type: [],
    accountStatus: [],
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
}

function parseSort(searchParams: URLSearchParams): RequestSort {
  const raw = searchParams.get("sort");
  const option = VALID_SORT_OPTIONS.find((o) => o.value === raw);
  if (option) return { key: option.key, dir: option.dir };
  return { key: "requested", dir: "desc" };
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page"));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

function parseSize(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("size"));
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

export default function AdminOrganizerRequestsPage() {
  const {
    requests: queriedRequests,
    isLoading,
    error,
    refetch,
    approve: approveRequest,
    isApproving,
    approveError,
    approveErrorId,
    reject: rejectRequest,
    isRejecting,
    rejectError,
    rejectErrorId,
  } = useOrganizerRequests();

  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [announcement, setAnnouncement] = useState("");

  const requests = useMemo(() => queriedRequests ?? [], [queriedRequests]);

  const { view, filters, sort, page, size, pagedRequests, total } = useMemo(() => {
    const parsedView = parseView(searchParams);
    const parsedFilters = parseFilters(searchParams);
    const parsedSort = parseSort(searchParams);
    const parsedPage = parsePage(searchParams);
    const parsedSize = parseSize(searchParams);

    // Apply the view tab first, then filters, then sort — same pipeline
    // shape as AdminUsersPage's `applyUserView → applyUserFilters → sort`.
    const viewed = applyRequestView(requests, parsedView);
    const filtered = applyRequestFilters(viewed, parsedFilters);
    const sorted = applyRequestSort(filtered, parsedSort.key, parsedSort.dir);

    const start = (parsedPage - 1) * parsedSize;

    return {
      view: parsedView,
      filters: parsedFilters,
      sort: parsedSort,
      page: parsedPage,
      size: parsedSize,
      pagedRequests: sorted.slice(start, start + parsedSize),
      total: sorted.length,
    };
  }, [requests, searchParams]);

  const counts = useMemo(() => requestViewCounts(requests), [requests]);

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

  const handleViewChange = (nextView: RequestView) => {
    updateParams({ view: nextView });
  };

  const handleFiltersChange = (nextFilters: RequestFilters) => {
    updateParams({
      q: nextFilters.q || null,
    });
  };

  const clearAllFilters = () => {
    updateParams({ q: null, from: null, to: null });
  };

  const handleToolbarSortChange = (nextSort: RequestSort) => {
    const option = REQUEST_SORT_OPTIONS.find(
      (o) => o.key === nextSort.key && o.dir === nextSort.dir
    );
    updateParams({ sort: option?.value ?? null }, false);
  };

  const handleTableSortChange = (key: string) => {
    const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "desc";
    const option = REQUEST_SORT_OPTIONS.find((o) => o.key === key && o.dir === dir);
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

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => updateParams({ q: null }) });
  if (filters.from || filters.to) {
    const label =
      filters.from && filters.to
        ? `${filters.from} – ${filters.to}`
        : filters.from
          ? `From ${filters.from}`
          : `Until ${filters.to!}`;
    chips.push({ key: "date", label, onRemove: () => updateParams({ from: null, to: null }) });
  }

  const noFiltersActive = chips.length === 0;

  const busy = isApproving
    ? { id: approveErrorId ?? "", action: "approve" as RequestRowAction }
    : isRejecting
      ? { id: rejectErrorId ?? "", action: "reject" as RequestRowAction }
      : null;

  const handleRowAction = (action: RequestRowAction, target: OrganizerRequestRow) => {
    if (action === "view") {
      window.location.href = `/admin/organizer-requests/${target.id}`;
    } else if (action === "approve") {
      setPendingAction({ kind: "approve", request: target });
    } else if (action === "reject") {
      setPendingAction({ kind: "reject", request: target });
    }
  };

  const closeDialog = () => setPendingAction(null);

  const confirmApprove = () => {
    if (!pendingAction) return;
    approveRequest({
      id: pendingAction.request.id,
      internal_note: null,
    });
    setPendingAction(null);
    setAnnouncement("Organizer access granted.");
  };

  const confirmReject = (params: {
    reason_code: import("../features/admin/model/organizerRequestsQuery").RejectionReasonCode;
    reason_message?: string | null;
    internal_note?: string | null;
  }) => {
    if (!pendingAction) return;
    rejectRequest({
      id: pendingAction.request.id,
      reason_code: params.reason_code,
      reason_message: params.reason_message,
      internal_note: params.internal_note,
    });
    setPendingAction(null);
    setAnnouncement("Organizer request rejected.");
  };

  const isError = !!error;
  const emptyDb = !isLoading && !isError && requests.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Organizer Requests"
        description="Review organizer requests. Approve to grant organizer access — the applicant can create and publish events under the proposed brand."
      />

      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      {!isLoading && isError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load organizer requests.</p>
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
          <AdminViewTabs
            views={REQUEST_VIEWS}
            active={view}
            counts={counts}
            panelId="admin-organizer-requests-tabpanel"
            ariaLabel="Request views"
            selectId="admin-organizer-requests-view-select"
            selectLabel="Request view"
            onChange={handleViewChange}
          />

          <div className="admin-card admin-organizer-requests-page__toolbar-card">
            <AdminOrganizerRequestsToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              sort={sort}
              onSortChange={handleToolbarSortChange}
              drawerFilterCount={0 /* type + accountStatus + date range — wired later */}
              onOpenDrawer={() => setDrawerOpen(true)}
            />

            {chips.length > 0 && (
              <div className="admin-organizer-requests-page__chips">
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
                    className="admin-btn admin-btn--ghost admin-organizer-requests-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p role="status" className="admin-organizer-requests-page__result-count">
            {total} request{total === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-organizer-requests-page__table-card"
            id="admin-organizer-requests-tabpanel"
            role="tabpanel"
            aria-labelledby={`admin-view-tab-${view}`}
          >
            {isLoading ? (
              <div className="admin-organizer-requests-page__skeleton" aria-busy="true">
                <p role="status" className="admin-organizer-requests-page__status">
                  Loading organizer requests…
                </p>
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="admin-organizer-requests-page__skeleton-row"
                    aria-hidden="true"
                  >
                    <span className="admin-skeleton admin-organizer-requests-page__skeleton-avatar" />
                    <span className="admin-organizer-requests-page__skeleton-lines">
                      <span className="admin-skeleton admin-organizer-requests-page__skeleton-line" />
                      <span className="admin-skeleton admin-organizer-requests-page__skeleton-line admin-organizer-requests-page__skeleton-line--short" />
                    </span>
                    <span className="admin-skeleton admin-organizer-requests-page__skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-organizer-requests-page__empty">
                <h2>No organizer requests</h2>
                <p>Organizer requests appear here as soon as someone submits one.</p>
              </div>
            ) : total === 0 && !noFiltersActive ? (
              <div className="admin-organizer-requests-page__empty">
                <h2>No requests match these filters.</h2>
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
                <AdminOrganizerRequestsTable
                  requests={pagedRequests}
                  sort={sort}
                  onSortChange={handleTableSortChange}
                  onAction={handleRowAction}
                  busy={busy}
                  errorId={approveErrorId ?? rejectErrorId}
                  error={approveError || rejectError}
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

      <AdminOrganizerRequestsFilterDrawer
        open={drawerOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Quick-approve confirmation — pre-checked accounts only via the dialog.
          The table's action menu routes here for approval. */}
      {pendingAction?.kind === "approve" && (
        <AdminConfirmDialog
          title={`Approve organizer access for ${pendingAction.request.applicant_username ? `@${pendingAction.request.applicant_username}` : (pendingAction.request.proposed_name ?? "this organizer")}?`}
          body="This person will be able to create and publish their own events, edit and cancel them, and manage an organizer brand. They will NOT receive Moderator or Admin permissions."
          confirmLabel="Approve Organizer"
          isBusy={isApproving}
          tone="neutral"
          error={approveErrorId === pendingAction.request.id ? approveError : null}
          onConfirm={confirmApprove}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "reject" && (
        <AdminRejectOrganizerDialog
          open
          isBusy={isRejecting}
          error={rejectErrorId === pendingAction.request.id ? rejectError : null}
          onCancel={closeDialog}
          onConfirm={confirmReject}
        />
      )}
    </>
  );
}

// Re-export types for the table's handler signature.
export type { RequestView, RequestSort, RequestStatus, RequestRowAction, ActionMenuItem };
