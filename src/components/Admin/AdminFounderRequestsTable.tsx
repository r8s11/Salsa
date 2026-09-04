import { Clock, Building2, Mail, MapPin, Globe } from "lucide-react";
import AdminActionMenu from "./AdminActionMenu";
import {
  founderRequestActionItems,
  type FounderAccessRequestRow,
} from "../../features/admin/model/founderRequestsQuery";
import "./AdminFounderRequestsTable.css";

interface AdminFounderRequestsTableProps {
  requests: FounderAccessRequestRow[];
  onAction: (action: "view" | "approve" | "reject", request: FounderAccessRequestRow) => void;
  isLoading?: boolean;
  isAdmin: boolean;
}

function formatDateLocal(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RequestRow({
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
  return (
    <tr key={request.id}>
      <td>
        <div className="request-cell">
          <div className="request-title">{request.applicant_name}</div>
          <div className="request-meta">
            <span className="meta-item">
              <Mail size={12} />
              {request.email}
            </span>
            <span className="meta-item">
              <Building2 size={12} />
              {request.organization_name}
            </span>
          </div>
        </div>
      </td>
      <td>
        <div className="contact-col">
          {request.city && (
            <div className="meta-item">
              <MapPin size={12} />
              {request.city}
              {request.region && `, ${request.region}`}
            </div>
          )}
          {request.instagram && (
            <div className="meta-item">
              @{request.instagram}
            </div>
          )}
          {request.website && (
            <div className="meta-item">
              <Globe size={12} />
              {request.website}
            </div>
          )}
        </div>
      </td>
      <td>
        <div className="date-col">
          <Clock size={14} />
          {formatDateLocal(request.created_at)}
        </div>
      </td>
      <td>
        <div className="status-col">
          <span className={`status-badge status-${request.status}`}>
            {request.status === "pending" && <Clock size={12} />}
            {request.status === "approved" && <span className="check-icon">✓</span>}
            {request.status === "rejected" && <span className="x-icon">✕</span>}
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>
          {request.reviewed_at && (
            <div className="reviewed-meta">
              Reviewed {formatDateLocal(request.reviewed_at)}
            </div>
          )}
        </div>
      </td>
      <td>
        <AdminActionMenu
          label={`Actions for ${request.applicant_name}`}
          items={items}
        />
      </td>
    </tr>
  );
}

function LoadingRow({ colSpan = 5 }: { colSpan?: number }) {
  return (
    <tr className="loading-row">
      <td colSpan={colSpan}>
        <div className="loading-placeholder">
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
}: AdminFounderRequestsTableProps) {
  if (isLoading) {
    return (
      <div className="admin-founder-requests-table-container">
        <table className="admin-founder-requests-table">
          <thead>
            <tr>
              <th>Applicant / Organization</th>
              <th>Contact</th>
              <th>Submitted</th>
              <th>Status</th>
              <th className="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => <LoadingRow key={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="admin-founder-requests-table-container empty">
        <div className="empty-state">
          <p>No founder requests found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-founder-requests-table-container">
      <table className="admin-founder-requests-table">
        <thead>
          <tr>
            <th>Applicant / Organization</th>
            <th>Contact</th>
            <th>Submitted</th>
            <th>Status</th>
            <th className="actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} onAction={onAction} isAdmin={isAdmin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
