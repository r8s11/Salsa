import { Fragment, type ComponentType, type ReactNode } from "react";
import { Clock, MapPin, Globe } from "lucide-react";
import AdminActionMenu from "./AdminActionMenu";
import {
  founderRequestActionItems,
  type FounderAccessRequestRow,
} from "../../features/admin/model/founderRequestsQuery";
import "./AdminFounderRequestsTable.css";

function formatDateLocal(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** One line of stacked, icon-led contact/location information. */
function MetaItem({
  icon: Icon,
  children,
  title,
}: {
  // lucide icons accept an optional className via the SVG props; the broader
  // type is used because tsc -b strictly checks prop spread.
  icon: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="founder-meta-item" title={title}>
      <Icon size={12} className="founder-meta-item__icon" aria-hidden="true" />
      <span className="founder-meta-item__value">{children}</span>
    </div>
  );
}

function RequestRowDesktop({
  request,
  onAction,
  isAdmin,
}: {
  request: FounderAccessRequestRow;
  onAction: (action: "view" | "approve" | "reject", request: FounderAccessRequestRow) => void;
  isAdmin: boolean;
}) {
  const items = founderRequestActionItems(request, (action, req) => onAction(action, req)).filter(
    (item) => isAdmin || (item.id !== "approve" && item.id !== "reject")
  );

  const applicantName = request.applicant_name || "—";
  const email = request.email;
  const orgName = request.organization_name;
  const location = request.city
    ? `${request.city}${request.region ? `, ${request.region}` : ""}`
    : null;

  return (
    <tr className="founder-request-row" data-request-id={request.id}>
      {/* Applicant / Organization — stacked: name, email, org */}
      <td className="col-applicant">
        <div className="founder-stacked-cell">
          <div className="founder-primary">{applicantName}</div>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="founder-secondary founder-link"
              title={email}
              aria-label={`Email ${applicantName}`}
            >
              {email}
            </a>
          ) : null}
          {orgName ? (
            <span className="founder-tertiary" title={orgName}>
              {orgName}
            </span>
          ) : null}
        </div>
      </td>

      {/* Contact — stacked: location, instagram, website */}
      <td className="col-contact">
        <div className="founder-stacked-cell founder-contact-cell">
          {location ? <MetaItem icon={MapPin}>{location}</MetaItem> : null}
          {request.instagram ? (
            <MetaItem icon={Globe} title={`@${request.instagram}`}>
              <a
                href={`https://instagram.com/${request.instagram.replace(/^@/, "")}`}
                className="founder-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${request.instagram}`}
              >
                @{request.instagram}
              </a>
            </MetaItem>
          ) : null}
          {request.website ? (
            <MetaItem icon={Globe} title={request.website}>
              <a
                href={
                  request.website.match(/^https?:\/\//)
                    ? request.website
                    : `https://${request.website}`
                }
                className="founder-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Website ${request.website}`}
              >
                {request.website}
              </a>
            </MetaItem>
          ) : null}
        </div>
      </td>

      {/* Submitted */}
      <td className="col-submitted">
        <div className="founder-date-cell">
          <Clock size={14} aria-hidden="true" />
          <span>{formatDateLocal(request.created_at)}</span>
        </div>
      </td>

      {/* Status — icon + label, plus review metadata line */}
      <td className="col-status">
        <div className="founder-status-cell">
          <span
            className={`founder-status-badge founder-status-badge--${request.status}`}
            aria-label={request.status}
          >
            <span className="founder-status-icon" aria-hidden="true">
              {request.status === "pending" && "⏳"}
              {request.status === "approved" && "✓"}
              {request.status === "rejected" && "✕"}
            </span>
            <span className="founder-status-label">
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </span>
          {request.reviewed_at ? (
            <div
              className="founder-status-meta"
              aria-label={`Reviewed ${formatDateLocal(request.reviewed_at)}`}
            >
              Reviewed {formatDateLocal(request.reviewed_at)}
            </div>
          ) : null}
        </div>
      </td>

      {/* Actions — always-right-aligned, consistent */}
      <td className="col-actions">
        <div className="founder-actions-cell">
          <AdminActionMenu label={`Actions for ${applicantName}`} items={items} />
        </div>
      </td>
    </tr>
  );
}

function RequestRowMobileCard({
  request,
  onAction,
  isAdmin,
}: {
  request: FounderAccessRequestRow;
  onAction: (action: "view" | "approve" | "reject", request: FounderAccessRequestRow) => void;
  isAdmin: boolean;
}) {
  const items = founderRequestActionItems(request, (action, req) => onAction(action, req)).filter(
    (item) => isAdmin || (item.id !== "approve" && item.id !== "reject")
  );

  const applicantName = request.applicant_name || "—";
  const email = request.email;
  const orgName = request.organization_name;
  const location = request.city
    ? `${request.city}${request.region ? `, ${request.region}` : ""}`
    : null;

  return (
    <tr className="founder-mobile-card" data-request-id={request.id}>
      <td className="founder-mobile-card__body" colSpan={5}>
        <div className="founder-mobile-card__row">
          <div className="founder-mobile-card__field" data-label="Applicant / Organization">
            <div className="founder-stacked-cell">
              <div className="founder-primary">{applicantName}</div>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="founder-secondary founder-link"
                  title={email}
                  aria-label={`Email ${applicantName}`}
                >
                  {email}
                </a>
              ) : null}
              {orgName ? (
                <span className="founder-tertiary" title={orgName}>
                  {orgName}
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="founder-mobile-card__field"
            data-label="Contact"
            aria-label={
              location ||
              (request.instagram ? `@${request.instagram}` : undefined) ||
              (request.website ? request.website : undefined) ||
              "No contact information"
            }
          >
            <div className="founder-stacked-cell founder-contact-cell">
              {location ? <MetaItem icon={MapPin}>{location}</MetaItem> : null}
              {request.instagram ? (
                <MetaItem icon={Globe} title={`@${request.instagram}`}>
                  <a
                    href={`https://instagram.com/${request.instagram.replace(/^@/, "")}`}
                    className="founder-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Instagram ${request.instagram}`}
                  >
                    @{request.instagram}
                  </a>
                </MetaItem>
              ) : null}
              {request.website ? (
                <MetaItem icon={Globe} title={request.website}>
                  <a
                    href={
                      request.website.match(/^https?:\/\//)
                        ? request.website
                        : `https://${request.website}`
                    }
                    className="founder-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Website ${request.website}`}
                  >
                    {request.website}
                  </a>
                </MetaItem>
              ) : null}
            </div>
          </div>
        </div>
        <div className="founder-mobile-card__row">
          <div className="founder-mobile-card__field" data-label="Submitted">
            <div className="founder-date-cell">
              <Clock size={14} aria-hidden="true" />
              <span>{formatDateLocal(request.created_at)}</span>
            </div>
          </div>
          <div className="founder-mobile-card__field" data-label="Status">
            <div className="founder-status-cell">
              <span
                className={`founder-status-badge founder-status-badge--${request.status}`}
                aria-label={request.status}
              >
                <span className="founder-status-icon" aria-hidden="true">
                  {request.status === "pending" && "⏳"}
                  {request.status === "approved" && "✓"}
                  {request.status === "rejected" && "✕"}
                </span>
                <span className="founder-status-label">
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </span>
              {request.reviewed_at ? (
                <div className="founder-status-meta">
                  Reviewed {formatDateLocal(request.reviewed_at)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="founder-mobile-card__actions">
          <AdminActionMenu label={`Actions for ${applicantName}`} items={items} />
        </div>
      </td>
    </tr>
  );
}

function LoadingRow({ colSpan = 5 }: { colSpan?: number }) {
  return (
    <tr className="founder-loading-row">
      <td colSpan={colSpan}>
        <div className="founder-loading-placeholder">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-meta"></div>
          <div className="skeleton skeleton-meta short"></div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminFounderRequestsTable({
  requests,
  onAction,
  isLoading = false,
  isAdmin,
}: {
  requests: FounderAccessRequestRow[];
  onAction: (action: "view" | "approve" | "reject", request: FounderAccessRequestRow) => void;
  isLoading?: boolean;
  isAdmin: boolean;
}) {
  if (isLoading) {
    return (
      <div className="admin-founder-requests-table-container">
        <table className="admin-founder-requests-table">
          <colgroup>
            <col className="col-applicant" />
            <col className="col-contact" />
            <col className="col-submitted" />
            <col className="col-status" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-applicant">Applicant / Organization</th>
              <th className="col-contact">Contact</th>
              <th className="col-submitted">Submitted</th>
              <th className="col-status">Status</th>
              <th className="col-actions actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <LoadingRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="admin-founder-requests-table-container empty">
        <div className="founder-empty-state">
          <p>No founder requests found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-founder-requests-table-container">
      <table className="admin-founder-requests-table">
        <colgroup>
          <col className="col-applicant" />
          <col className="col-contact" />
          <col className="col-submitted" />
          <col className="col-status" />
          <col className="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-applicant">Applicant / Organization</th>
            <th className="col-contact">Contact</th>
            <th className="col-submitted">Submitted</th>
            <th className="col-status">Status</th>
            <th className="col-actions actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <Fragment key={request.id}>
              <RequestRowDesktop request={request} onAction={onAction} isAdmin={isAdmin} />
              <RequestRowMobileCard request={request} onAction={onAction} isAdmin={isAdmin} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
