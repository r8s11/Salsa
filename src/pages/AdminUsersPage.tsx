import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAuth } from "../contexts/useAuth";
import {
  applyUserView,
  applyUserFilters,
  applyUserSort,
  userViewCounts,
  USER_VIEWS,
  ROLE_LABEL,
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_KIND_LABEL,
  type AdminUserRow,
  type AccountKind,
  type AccountStatus,
  type UserFilters,
  type UserRole,
  type UserSortKey,
  type UserView,
  type SortDir,
} from "../features/admin/model/usersQuery";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../features/admin/model/eventsQuery";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminViewTabs from "../components/Admin/AdminViewTabs";
import AdminUsersToolbar from "../components/Admin/AdminUsersToolbar";
import AdminUsersFilterDrawer from "../components/Admin/AdminUsersFilterDrawer";
import AdminUsersTable, { type UserRowAction } from "../components/Admin/AdminUsersTable";
import AdminPagination from "../components/Admin/AdminPagination";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminRoleChangeDialog from "../components/Admin/AdminRoleChangeDialog";
import AdminFlagUserDialog from "../components/Admin/AdminFlagUserDialog";
import "./AdminUsersPage.css";

type PendingUserAction =
  | { kind: "role"; user: AdminUserRow }
  | { kind: "flag"; user: AdminUserRow }
  | { kind: "suspend"; user: AdminUserRow }
  | { kind: "ban"; user: AdminUserRow }
  | { kind: "restore"; user: AdminUserRow }
  | { kind: "unflag"; user: AdminUserRow }
  | null;

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const VALID_VIEWS: UserView[] = USER_VIEWS.map((entry) => entry.view);
const VALID_ROLES: UserRole[] = ["user", "moderator", "organizer", "admin"];
const VALID_STATUSES: AccountStatus[] = ["active", "flagged", "suspended", "banned"];
const VALID_KINDS: AccountKind[] = ["profile", "guest"];
const VALID_SORT_KEYS: UserSortKey[] = ["joined", "name", "contributions", "active"];

function parseView(searchParams: URLSearchParams): UserView {
  const raw = searchParams.get("view");
  return VALID_VIEWS.includes(raw as UserView) ? (raw as UserView) : "all";
}

function parseFilters(searchParams: URLSearchParams): UserFilters {
  const role = (searchParams.get("role")?.split(",").filter(Boolean) ?? []).filter(
    (value): value is UserRole => VALID_ROLES.includes(value as UserRole)
  );
  const status = (searchParams.get("status")?.split(",").filter(Boolean) ?? []).filter(
    (value): value is AccountStatus => VALID_STATUSES.includes(value as AccountStatus)
  );
  const rawKind = searchParams.get("type");
  const kind = VALID_KINDS.includes(rawKind as AccountKind) ? (rawKind as AccountKind) : null;

  return {
    q: searchParams.get("q") ?? "",
    role,
    status,
    kind,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
}

function parseSort(searchParams: URLSearchParams): { key: UserSortKey; dir: SortDir } {
  const rawKey = searchParams.get("sort");
  const key = VALID_SORT_KEYS.includes(rawKey as UserSortKey) ? (rawKey as UserSortKey) : "joined";
  const rawDir = searchParams.get("dir");
  const dir: SortDir = rawDir === "asc" ? "asc" : "desc";
  return { key, dir };
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page"));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
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
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const {
    users: queriedUsers,
    isLoading,
    error,
    refetch,
    setRole,
    settingRoleId,
    roleErrorId,
    roleError,
    setStatus,
    settingStatusId,
    statusErrorId,
    statusError,
  } = useAdminUsers();

  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingAction, setPendingAction] = useState<PendingUserAction>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastRowAction, setLastRowAction] = useState<UserRowAction | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);

  const { view, filters, sort, page, size, pagedUsers, total } = useMemo(() => {
    const parsedView = parseView(searchParams);
    const parsedFilters = parseFilters(searchParams);
    const parsedSort = parseSort(searchParams);
    const parsedPage = parsePage(searchParams);
    const parsedSize = parseSize(searchParams);

    const viewed = applyUserView(users, parsedView);
    const filtered = applyUserFilters(viewed, parsedFilters);
    const sorted = applyUserSort(filtered, parsedSort.key, parsedSort.dir);
    const start = (parsedPage - 1) * parsedSize;

    return {
      view: parsedView,
      filters: parsedFilters,
      sort: parsedSort,
      page: parsedPage,
      size: parsedSize,
      pagedUsers: sorted.slice(start, start + parsedSize),
      total: sorted.length,
    };
  }, [users, searchParams]);

  const counts = useMemo(() => userViewCounts(users), [users]);
  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);

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

  const handleViewChange = (nextView: UserView) => {
    updateParams({ view: nextView });
  };

  const handleFiltersChange = (nextFilters: UserFilters) => {
    updateParams({
      q: nextFilters.q || null,
      role: nextFilters.role.length > 0 ? nextFilters.role.join(",") : null,
      status: nextFilters.status.length > 0 ? nextFilters.status.join(",") : null,
      type: nextFilters.kind,
      from: nextFilters.from,
      to: nextFilters.to,
    });
  };

  const clearAllFilters = () => {
    updateParams({ q: null, role: null, status: null, type: null, from: null, to: null });
  };

  const handleToolbarSortChange = (nextSort: { key: UserSortKey; dir: SortDir }) => {
    updateParams({ sort: nextSort.key, dir: nextSort.dir }, false);
  };

  const handleTableSortChange = (key: UserSortKey) => {
    const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "desc";
    updateParams({ sort: key, dir }, false);
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
  filters.role.forEach((role) => {
    chips.push({
      key: `role-${role}`,
      label: ROLE_LABEL[role],
      onRemove: () =>
        updateParams({ role: filters.role.filter((r) => r !== role).join(",") || null }),
    });
  });
  filters.status.forEach((status) => {
    chips.push({
      key: `status-${status}`,
      label: ACCOUNT_STATUS_LABEL[status],
      onRemove: () =>
        updateParams({ status: filters.status.filter((s) => s !== status).join(",") || null }),
    });
  });
  if (filters.kind) {
    chips.push({
      key: "kind",
      label: ACCOUNT_KIND_LABEL[filters.kind],
      onRemove: () => updateParams({ type: null }),
    });
  }
  if (filters.from || filters.to) {
    const label =
      filters.from && filters.to
        ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
        : filters.from
          ? `From ${formatShortDate(filters.from)}`
          : `Until ${formatShortDate(filters.to!)}`;
    chips.push({ key: "date", label, onRemove: () => updateParams({ from: null, to: null }) });
  }

  const drawerFilterCount = [filters.kind, filters.from, filters.to].filter(Boolean).length;

  const busy = settingRoleId
    ? { id: settingRoleId, action: lastRowAction ?? "change-role" }
    : settingStatusId
      ? { id: settingStatusId, action: lastRowAction ?? "suspend" }
      : null;
  const errorId = roleErrorId ?? statusErrorId;
  const rowError = roleErrorId ? roleError : statusErrorId ? statusError : null;

  const handleRowAction = (action: UserRowAction, targetUser: AdminUserRow) => {
    setLastRowAction(action);
    switch (action) {
      case "view-contributions": {
        const value = targetUser.kind === "guest" ? targetUser.email : (targetUser.user_id ?? "");
        navigate(`/admin/events?submitter=${encodeURIComponent(value)}`);
        break;
      }
      case "change-role":
        setPendingAction({ kind: "role", user: targetUser });
        break;
      case "flag":
        setPendingAction({ kind: "flag", user: targetUser });
        break;
      case "unflag":
        setPendingAction({ kind: "unflag", user: targetUser });
        break;
      case "suspend":
        setPendingAction({ kind: "suspend", user: targetUser });
        break;
      case "ban":
        setPendingAction({ kind: "ban", user: targetUser });
        break;
      case "restore":
        setPendingAction({ kind: "restore", user: targetUser });
        break;
    }
  };

  const closeDialog = () => setPendingAction(null);

  const confirmRoleChange = (role: UserRole) => {
    if (!pendingAction || pendingAction.kind !== "role") return;
    setRole(
      { id: pendingAction.user.id, role },
      {
        onSuccess: () => {
          setAnnouncement(`Role changed to ${ROLE_LABEL[role]}`);
          closeDialog();
        },
      }
    );
  };

  const confirmFlag = (reason: string) => {
    if (!pendingAction || pendingAction.kind !== "flag") return;
    setStatus(
      { id: pendingAction.user.id, status: "flagged", reason },
      {
        onSuccess: () => {
          setAnnouncement(`${identityLabel(pendingAction.user)} flagged`);
          closeDialog();
        },
      }
    );
  };

  const confirmStatusChange = (status: AccountStatus, successLabel: string, reason?: string) => {
    if (!pendingAction) return;
    setStatus(
      { id: pendingAction.user.id, status, reason: reason ?? null },
      {
        onSuccess: () => {
          setAnnouncement(successLabel);
          closeDialog();
        },
      }
    );
  };

  function identityLabel(targetUser: AdminUserRow): string {
    return targetUser.username ? `@${targetUser.username}` : targetUser.display_name || "Account";
  }

  const isRoleDialogBusy = pendingAction?.kind === "role" && settingRoleId === pendingAction.user.id;
  const isStatusDialogBusy =
    pendingAction !== null &&
    pendingAction.kind !== "role" &&
    settingStatusId === pendingAction.user.id;

  const noFiltersActive = chips.length === 0;
  const emptyDb = !isLoading && !error && users.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Manage SalsaSegura accounts, roles, and account status."
      />

      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load users.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <AdminViewTabs
            views={USER_VIEWS}
            active={view}
            counts={counts}
            panelId="admin-users-tabpanel"
            ariaLabel="User views"
            selectId="admin-users-view-select"
            selectLabel="User view"
            onChange={handleViewChange}
          />

          <div className="admin-card admin-users-page__toolbar-card">
            <AdminUsersToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              sort={sort}
              onSortChange={handleToolbarSortChange}
              drawerFilterCount={drawerFilterCount}
              onOpenDrawer={() => setDrawerOpen(true)}
            />

            {chips.length > 0 && (
              <div className="admin-users-page__chips">
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
                    className="admin-btn admin-btn--ghost admin-users-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p role="status" className="admin-users-page__result-count">
            {total} user{total === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-users-page__table-card"
            id="admin-users-tabpanel"
            role="tabpanel"
            aria-labelledby={`admin-view-tab-${view}`}
          >
            {isLoading ? (
              <div className="admin-users-page__skeleton" aria-busy="true">
                <p role="status" className="admin-users-page__status">
                  Loading users…
                </p>
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="admin-users-page__skeleton-row" aria-hidden="true">
                    <span className="admin-skeleton admin-users-page__skeleton-avatar" />
                    <span className="admin-users-page__skeleton-lines">
                      <span className="admin-skeleton admin-users-page__skeleton-line" />
                      <span className="admin-skeleton admin-users-page__skeleton-line admin-users-page__skeleton-line--short" />
                    </span>
                    <span className="admin-skeleton admin-users-page__skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-users-page__empty">
                <h2>No users yet</h2>
                <p>Accounts appear here as soon as someone signs up.</p>
              </div>
            ) : total === 0 && !noFiltersActive ? (
              <div className="admin-users-page__empty">
                <h2>No users match these filters.</h2>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={clearAllFilters}>
                  Clear Filters
                </button>
              </div>
            ) : total === 0 && view === "flagged" ? (
              <div className="admin-users-page__empty">
                <h2>No flagged accounts.</h2>
              </div>
            ) : total === 0 && view === "suspended" ? (
              <div className="admin-users-page__empty">
                <h2>No suspended accounts.</h2>
              </div>
            ) : total === 0 && view === "banned" ? (
              <div className="admin-users-page__empty">
                <h2>No banned accounts.</h2>
              </div>
            ) : total === 0 && view === "guests" ? (
              <div className="admin-users-page__empty">
                <h2>No magic-link submitters.</h2>
              </div>
            ) : total === 0 ? (
              <div className="admin-users-page__empty">
                <h2>No {USER_VIEWS.find((entry) => entry.view === view)?.label} users</h2>
              </div>
            ) : (
              <>
                <AdminUsersTable
                  users={pagedUsers}
                  currentUserId={user?.id ?? null}
                  adminCount={adminCount}
                  isAdmin={isAdmin}
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

      <AdminUsersFilterDrawer
        open={drawerOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setDrawerOpen(false)}
      />

      {pendingAction?.kind === "role" && (
        <AdminRoleChangeDialog
          user={pendingAction.user}
          isBusy={isRoleDialogBusy}
          error={roleErrorId === pendingAction.user.id ? roleError : null}
          onConfirm={confirmRoleChange}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "flag" && (
        <AdminFlagUserDialog
          user={pendingAction.user}
          isBusy={isStatusDialogBusy}
          error={statusErrorId === pendingAction.user.id ? statusError : null}
          onConfirm={confirmFlag}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "suspend" && (
        <AdminConfirmDialog
          title={`Suspend ${identityLabel(pendingAction.user)}?`}
          body="This account will temporarily lose access to restricted platform actions, including submitting events. You can restore it at any time."
          confirmLabel="Suspend User"
          tone="danger"
          reasonField={{ label: "Reason (optional)", required: false }}
          isBusy={isStatusDialogBusy}
          error={statusErrorId === pendingAction.user.id ? statusError : null}
          onConfirm={(reason) => confirmStatusChange("suspended", `${identityLabel(pendingAction.user)} suspended`, reason)}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "ban" && (
        <AdminConfirmDialog
          title={`Ban ${identityLabel(pendingAction.user)}?`}
          body="This user will lose access to SalsaSegura when their session next refreshes. Existing content will not automatically be deleted."
          confirmLabel="Ban User"
          tone="danger"
          reasonField={{ label: "Reason", required: true }}
          isBusy={isStatusDialogBusy}
          error={statusErrorId === pendingAction.user.id ? statusError : null}
          onConfirm={(reason) => confirmStatusChange("banned", `${identityLabel(pendingAction.user)} banned`, reason)}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "restore" && (
        <AdminConfirmDialog
          title={`Restore access for ${identityLabel(pendingAction.user)}?`}
          body="Access is restored immediately. Their role is unchanged."
          confirmLabel="Restore access"
          tone="neutral"
          isBusy={isStatusDialogBusy}
          error={statusErrorId === pendingAction.user.id ? statusError : null}
          onConfirm={() => confirmStatusChange("active", `${identityLabel(pendingAction.user)} restored`)}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "unflag" && (
        <AdminConfirmDialog
          title={`Remove the flag on ${identityLabel(pendingAction.user)}?`}
          body="The account returns to Active. The flag reason is cleared."
          confirmLabel="Remove flag"
          tone="neutral"
          isBusy={isStatusDialogBusy}
          error={statusErrorId === pendingAction.user.id ? statusError : null}
          onConfirm={() => confirmStatusChange("active", "Flag removed")}
          onCancel={closeDialog}
        />
      )}
    </>
  );
}
