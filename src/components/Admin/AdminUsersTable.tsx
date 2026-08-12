import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  type AdminUserRow,
  type UserSortKey,
  type SortDir,
  displayNameFor,
  identityLineFor,
  rowActionItems,
  type UserRowAction,
} from "../../features/admin/model/usersQuery";

export type { UserRowAction } from "../../features/admin/model/usersQuery";
import AdminRoleBadge from "./AdminRoleBadge";
import AdminAccountStatusBadge from "./AdminAccountStatusBadge";
import AdminActionMenu from "./AdminActionMenu";
import AdminUserAvatar from "./AdminUserAvatar";
import "./AdminUsersTable.css";

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function contributionsLabel(row: AdminUserRow): string {
  if (row.contributions === 0) return "No contributions";
  return `${row.contributions} contribution${row.contributions === 1 ? "" : "s"}`;
}

interface AdminUsersTableProps {
  users: AdminUserRow[];
  currentUserId: string | null;
  adminCount: number;
  sort: { key: UserSortKey; dir: SortDir };
  onSortChange: (key: UserSortKey) => void;
  onAction: (action: UserRowAction, user: AdminUserRow) => void;
  busy?: { id: string; action: UserRowAction } | null;
  errorId?: string | null;
  error?: string | null;
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  sortKey: UserSortKey;
  sort: { key: UserSortKey; dir: SortDir };
  onSortChange: (key: UserSortKey) => void;
  className?: string;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={ariaSort} className={className}>
      <button
        type="button"
        className="admin-users-table__sort-btn"
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <Icon size={12} />
      </button>
    </th>
  );
}

function UserCell({ row, currentUserId }: { row: AdminUserRow; currentUserId: string | null }) {
  return (
    <div className="admin-users-table__user">
      <AdminUserAvatar row={row} />
      <div className="admin-users-table__user-body">
        <p className="admin-users-table__name">
          <Link to={`/admin/users/${row.id}`}>{displayNameFor(row)}</Link>
          {row.user_id === currentUserId && <span className="admin-chip">You</span>}
        </p>
        <p
          className={
            row.kind === "guest"
              ? "admin-users-table__identity admin-users-table__identity--none"
              : "admin-users-table__identity"
          }
        >
          {identityLineFor(row)}
        </p>
        <p className="admin-users-table__secondary-line">
          {row.email} · Joined {formatJoined(row.created_at)}
        </p>
      </div>
    </div>
  );
}

export default function AdminUsersTable({
  users,
  currentUserId,
  adminCount,
  sort,
  onSortChange,
  onAction,
  busy,
  errorId,
  error,
}: AdminUsersTableProps) {
  return (
    <>
      <div className="admin-users-table__scroll">
        <table className="admin-users-table">
          <thead>
            <tr>
              <SortableHeader label="User" sortKey="name" sort={sort} onSortChange={onSortChange} />
              <th className="admin-users-table__col--email">Email</th>
              <th>Role</th>
              <th>Status</th>
              <SortableHeader
                label="Joined"
                sortKey="joined"
                sort={sort}
                onSortChange={onSortChange}
                className="admin-users-table__col--joined"
              />
              <SortableHeader
                label="Contributions"
                sortKey="contributions"
                sort={sort}
                onSortChange={onSortChange}
              />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const isBusy = busy?.id === row.id;

              return (
                <Fragment key={row.id}>
                  <tr style={isBusy ? { opacity: 0.6 } : undefined}>
                    <td>
                      <UserCell row={row} currentUserId={currentUserId} />
                    </td>
                    <td className="admin-users-table__col--email">
                      <p className="admin-users-table__muted">
                        <Mail size={12} /> {row.email}
                      </p>
                    </td>
                    <td>
                      <AdminRoleBadge role={row.role} />
                    </td>
                    <td>
                      <AdminAccountStatusBadge status={row.status} reason={row.status_reason} />
                    </td>
                    <td className="admin-users-table__col--joined">
                      {formatJoined(row.created_at)}
                    </td>
                    <td>
                      <p>{contributionsLabel(row)}</p>
                      {row.pending_count > 0 && (
                        <p className="admin-users-table__muted">{row.pending_count} pending</p>
                      )}
                    </td>
                    <td>
                      <AdminActionMenu
                        label={`Actions for ${displayNameFor(row)}`}
                        items={rowActionItems(row, currentUserId, adminCount, onAction)}
                        disabled={isBusy}
                      />
                    </td>
                  </tr>
                  {errorId === row.id && error && (
                    <tr className="admin-users-table__error">
                      <td colSpan={7} role="alert">
                        Action failed: {error}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="admin-users-cards">
        {users.map((row) => {
          const isBusy = busy?.id === row.id;

          return (
            <li
              key={row.id}
              className="admin-card admin-users-cards__item"
              style={isBusy ? { opacity: 0.6 } : undefined}
            >
              <div className="admin-users-cards__head">
                <AdminUserAvatar row={row} />
                <div className="admin-users-cards__head-body">
                  <p className="admin-users-table__name">
                    <Link to={`/admin/users/${row.id}`}>{displayNameFor(row)}</Link>
                    {row.user_id === currentUserId && <span className="admin-chip">You</span>}
                  </p>
                  <p
                    className={
                      row.kind === "guest"
                        ? "admin-users-table__identity admin-users-table__identity--none"
                        : "admin-users-table__identity"
                    }
                  >
                    {identityLineFor(row)}
                  </p>
                </div>
              </div>
              <div className="admin-users-cards__badges">
                {row.kind !== "guest" && <AdminRoleBadge role={row.role} />}
                <AdminAccountStatusBadge status={row.status} reason={row.status_reason} />
              </div>
              <div className="admin-users-cards__row">
                <span className="admin-users-cards__label">Joined</span>
                <span>{formatJoined(row.created_at)}</span>
              </div>
              <div className="admin-users-cards__row">
                <span className="admin-users-cards__label">Contributions</span>
                <span>
                  {row.pending_count > 0
                    ? `${row.contributions} · ${row.pending_count} pending`
                    : contributionsLabel(row)}
                </span>
              </div>
              {errorId === row.id && error && (
                <p className="admin-users-cards__error" role="alert">
                  Action failed: {error}
                </p>
              )}
              <div className="admin-users-cards__actions">
                <AdminActionMenu
                  label={`Actions for ${displayNameFor(row)}`}
                  items={rowActionItems(row, currentUserId, adminCount, onAction)}
                  disabled={isBusy}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
