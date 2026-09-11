import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { OrganizerRequestRow } from "../../features/admin/model/organizerRequestsQuery";
import {
  displayNameFor,
  identityLineFor,
  type AdminUserRow,
} from "../../features/admin/model/usersQuery";
import {
  ORGANIZER_TYPE_LABEL,
  type RequestRowAction,
  requestActionItems,
  type RequestStatus,
  type SortDir,
} from "../../features/admin/model/organizerRequestsQuery";
import AdminUserAvatar from "./AdminUserAvatar";
import AdminAccountStatusBadge from "./AdminAccountStatusBadge";
import AdminRequestStatusBadge from "./AdminRequestStatusBadge";
import AdminActionMenu, { type ActionMenuItem } from "./AdminActionMenu";
import "./AdminOrganizerRequestsTable.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Extracts the applicant profile as an `AdminUserRow` so we can reuse
 * `AdminUserAvatar`, `displayNameFor`, and `identityLineFor` — the same
 * shared vocabulary Phase 6's user-detail page reuses from the users table.
 */
function applicantRow(request: OrganizerRequestRow): AdminUserRow {
  return {
    kind: request.applicant_kind,
    id: request.applicant_id,
    user_id: request.applicant_user_id,
    email: request.applicant_email,
    display_name: request.applicant_display_name,
    username: request.applicant_username,
    avatar_url: request.applicant_avatar_url,
    role: request.applicant_role,
    status: request.applicant_status,
    status_reason: request.applicant_status_reason,
    created_at: request.applicant_created_at,
    last_active_at: "",
    contributions: request.applicant_contributions,
    pending_count: request.applicant_pending_count,
    email_confirmed_at: request.applicant_email_confirmed_at ?? null,
    approved_count: request.applicant_approved_count,
  };
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: string;
  sort: { key: string; dir: SortDir };
  onSortChange: (key: string) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className="admin-organizer-requests-table__sort-btn"
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <Icon size={12} />
      </button>
    </th>
  );
}

interface AdminOrganizerRequestsTableProps {
  requests: OrganizerRequestRow[];
  sort: { key: string; dir: SortDir };
  onSortChange: (key: string) => void;
  onAction: (action: RequestRowAction, request: OrganizerRequestRow) => void;
  busy: { id: string; action: RequestRowAction } | null;
  errorId: string | null;
  error: string | null;
}

function BrandCell({ request }: { request: OrganizerRequestRow }) {
  const brandName = request.proposed_name || "No brand name provided";
  const isExistingBrand = request.proposed_organizer_id !== null;
  return (
    <span>
      {brandName}
      {isExistingBrand && (
        <span
          className="admin-organizer-requests-table__existing-badge"
          title="Existing organizer brand — this request manages an existing brand"
        >
          ∞ existing
        </span>
      )}
    </span>
  );
}

function TypeCell({ request }: { request: OrganizerRequestRow }) {
  if (!request.organizer_type) {
    return <span className="admin-organizer-requests-table__muted">—</span>;
  }
  return (
    <span className="admin-chip admin-chip--type">
      {ORGANIZER_TYPE_LABEL[request.organizer_type]}
    </span>
  );
}

export default function AdminOrganizerRequestsTable({
  requests,
  sort,
  onSortChange,
  onAction,
  busy,
  errorId,
  error,
}: AdminOrganizerRequestsTableProps) {
  return (
    <>
      <div className="admin-organizer-requests-table__scroll">
        <table className="admin-organizer-requests-table">
          <thead>
            <tr>
              <SortableHeader
                label="Applicant"
                sortKey="name"
                sort={sort}
                onSortChange={onSortChange}
              />
              <th className="admin-organizer-requests-table__col--brand">Brand / Organization</th>
              <th className="admin-organizer-requests-table__col--type">Type</th>
              <SortableHeader
                label="Requested"
                sortKey="requested"
                sort={sort}
                onSortChange={onSortChange}
              />
              <th>Event Activity</th>
              <th>Account Status</th>
              <th>Request Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const isBusy = busy?.id === request.id;
              const applicant = applicantRow(request);
              return (
                <Fragment key={request.id}>
                  <tr style={isBusy ? { opacity: 0.6 } : undefined}>
                    <td>
                      <Link
                        to={`/admin/organizer-requests/${request.id}`}
                        className="admin-organizer-requests-table__title"
                      >
                        {displayNameFor(applicant)}
                      </Link>
                      <p className="admin-organizer-requests-table__identity">
                        {identityLineFor(applicant)}
                      </p>
                    </td>
                    <td className="admin-organizer-requests-table__col--brand">
                      <BrandCell request={request} />
                    </td>
                    <td className="admin-organizer-requests-table__col--type">
                      <TypeCell request={request} />
                    </td>
                    <td>{formatDate(request.created_at)}</td>
                    <td>
                      <p>{request.applicant_contributions} submissions</p>
                      <p className="admin-organizer-requests-table__muted">
                        {request.applicant_approved_count} approved
                      </p>
                    </td>
                    <td>
                      <AdminAccountStatusBadge
                        status={request.applicant_status}
                        reason={request.applicant_status_reason}
                      />
                    </td>
                    <td>
                      <AdminRequestStatusBadge status={request.status} />
                    </td>
                    <td>
                      <AdminActionMenu
                        label={`Actions for ${displayNameFor(applicant)}`}
                        items={requestActionItems(request, onAction)}
                        disabled={isBusy}
                      />
                    </td>
                  </tr>
                  {errorId === request.id && error && (
                    <tr className="admin-organizer-requests-table__error">
                      <td colSpan={8} role="alert">
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

      <ul className="admin-organizer-requests-cards">
        {requests.map((request) => {
          const isBusy = busy?.id === request.id;
          const applicant = applicantRow(request);
          return (
            <li
              key={request.id}
              className="admin-card admin-organizer-requests-cards__item"
              style={isBusy ? { opacity: 0.6 } : undefined}
            >
              <div className="admin-organizer-requests-cards__head">
                <AdminUserAvatar row={applicant} />
                <div className="admin-organizer-requests-cards__head-body">
                  <Link
                    to={`/admin/organizer-requests/${request.id}`}
                    className="admin-organizer-requests-table__title"
                  >
                    {displayNameFor(applicant)}
                  </Link>
                  <p className="admin-organizer-requests-table__identity">
                    {identityLineFor(applicant)}
                  </p>
                </div>
                <AdminRequestStatusBadge status={request.status} />
              </div>
              <div className="admin-organizer-requests-table__chips">
                <TypeCell request={request} />
                <AdminAccountStatusBadge
                  status={request.applicant_status}
                  reason={request.applicant_status_reason}
                />
              </div>
              <div className="admin-organizer-requests-cards__row">
                <span className="admin-organizer-requests-cards__label">Brand</span>
                <BrandCell request={request} />
              </div>
              <div className="admin-organizer-requests-cards__row">
                <span className="admin-organizer-requests-cards__label">Requested</span>
                <span>{formatDate(request.created_at)}</span>
              </div>
              <div className="admin-organizer-requests-cards__row">
                <span className="admin-organizer-requests-cards__label">Event Activity</span>
                <span>
                  {request.applicant_contributions} submission
                  {request.applicant_contributions === 1 ? "" : "s"} ·{" "}
                  {request.applicant_approved_count} approved
                </span>
              </div>
              {errorId === request.id && error && (
                <p className="admin-organizer-requests-cards__error" role="alert">
                  Action failed: {error}
                </p>
              )}
              <div className="admin-organizer-requests-cards__actions">
                <AdminActionMenu
                  label={`Actions for ${displayNameFor(applicant)}`}
                  items={requestActionItems(request, onAction)}
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

// Re-export for the page's type usage.
export type { RequestRowAction, RequestStatus, ActionMenuItem };
