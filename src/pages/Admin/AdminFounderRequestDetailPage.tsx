import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminApproveDialog from "../../components/Admin/AdminApproveDialog";
import AdminRejectFounderDialog from "../../components/Admin/AdminRejectFounderDialog";
import AdminFounderInvitationSection from "../../components/Admin/AdminFounderInvitationSection";
import { useFounderRequest, useFounderRequests } from "../../hooks/useFounderRequests";
import {
  type FounderRejectionReasonCode,
  FOUNDER_REQUEST_STATUS_LABEL,
  FOUNDER_REJECTION_REASON_LABEL,
} from "../../features/admin/model/founderRequestsQuery";
import "./AdminFounderRequestDetailPage.css";

export default function AdminFounderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, approveRequest, rejectRequest, isApproving, isRejecting } = useFounderRequests();
  const { data: request, isLoading, error } = useFounderRequest(id ?? null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const openApproveDialog = () => setShowApproveDialog(true);
  const openRejectDialog = () => setShowRejectDialog(true);

  const handleApprove = (requestId: string) => {
    approveRequest(requestId, {
      onSuccess: () => setShowApproveDialog(false),
    });
  };

  const handleReject = (requestId: string, reasonCode: string, message: string) => {
    rejectRequest(
      { requestId, reasonCode, message },
      { onSuccess: () => setShowRejectDialog(false) }
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <div className="admin-request-detail-page loading">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-meta"></div>
        <div className="skeleton skeleton-meta"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="admin-request-detail-page not-found">
        <h1>Request Not Found</h1>
        <p>The founder request could not be found.</p>
        <Link to="/admin/founder-requests" className="btn-secondary">
          ← Back to Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-request-detail-page">
      <header className="detail-header">
        <Link to="/admin/founder-requests" className="back-link">
          <ArrowLeft size={20} />
          Back to Requests
        </Link>
        <div className="header-actions">
          <span className={`status-badge status-${request.status}`}>
            {request.status === "pending" && <span className="icon">⏳</span>}
            {request.status === "approved" && <span className="icon">✓</span>}
            {request.status === "rejected" && <span className="icon">✕</span>}
            {FOUNDER_REQUEST_STATUS_LABEL[request.status]}
            {request.reviewed_at && (
              <span className="reviewed-badge">
                Reviewed {formatDate(request.reviewed_at)}
              </span>
            )}
          </span>
        </div>
      </header>

      <main className="detail-content">
        <section className="detail-section applicant-section">
          <h2>Applicant</h2>
          <div className="detail-grid">
            <div className="detail-field">
              <label>Name</label>
              <span>{request.applicant_name}</span>
            </div>
            <div className="detail-field">
              <label>Email</label>
              <a href={`mailto:${request.email}`}>{request.email}</a>
            </div>
            <div className="detail-field full-width">
              <label>Message from applicant</label>
              <div className="message-box">{request.message || "—"}</div>
            </div>
          </div>
        </section>

        <section className="detail-section organization-section">
          <h2>Organization</h2>
          <div className="detail-grid">
            <div className="detail-field">
              <label>Organization Name</label>
              <span>{request.organization_name}</span>
            </div>
            <div className="detail-field">
              <label>Instagram</label>
              {request.instagram ? (
                <a href={`https://instagram.com/${request.instagram}`} target="_blank" rel="noopener noreferrer">
                  @{request.instagram}
                </a>
              ) : (
                <span className="empty">—</span>
              )}
            </div>
            <div className="detail-field">
              <label>Website</label>
              {request.website ? (
                <a href={request.website} target="_blank" rel="noopener noreferrer">
                  {request.website}
                </a>
              ) : (
                <span className="empty">—</span>
              )}
            </div>
            <div className="detail-field">
              <label>City</label>
              <span>{request.city || "—"}</span>
            </div>
            <div className="detail-field">
              <label>Region / State</label>
              <span>{request.region || "—"}</span>
            </div>
            <div className="detail-field full-width">
              <label>Description</label>
              <div className="message-box">{request.description || "—"}</div>
            </div>
          </div>
        </section>

        {request.status !== "pending" && (
          <section className="detail-section review-section">
            <h2>Review</h2>
            <div className="detail-grid">
              <div className="detail-field">
                <label>Status</label>
                <span className={`status-badge status-${request.status}`}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>
              <div className="detail-field">
                <label>Reviewed at</label>
                <span>{request.reviewed_at ? formatDateTime(request.reviewed_at) : "—"}</span>
              </div>
              {request.status === "rejected" && (
                <>
                  <div className="detail-field">
                    <label>Rejection Reason</label>
                    <span>
                      {request.rejection_reason_code
                        ? FOUNDER_REJECTION_REASON_LABEL[
                            request.rejection_reason_code as FounderRejectionReasonCode
                          ]
                        : "—"}
                    </span>
                  </div>
                  <div className="detail-field full-width">
                    <label>Rejection Message</label>
                    <div className="message-box">{request.rejection_message || "—"}</div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {request.status === "approved" && (
          <AdminFounderInvitationSection founderRequestId={request.id} isAdmin={isAdmin} />
        )}

        {isAdmin && request.status === "pending" && (
          <div className="actions-bar">
            <button
              type="button"
              className="btn-secondary"
              onClick={openRejectDialog}
              disabled={false}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={openApproveDialog}
              disabled={false}
            >
              Approve
            </button>
          </div>
        )}
      </main>

      <AdminApproveDialog
        requestId={request.id}
        isBusy={isApproving}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveDialog(false)}
        isOpen={showApproveDialog}
      />

      <AdminRejectFounderDialog
        requestId={request.id}
        isBusy={isRejecting}
        onConfirm={handleReject}
        onCancel={() => setShowRejectDialog(false)}
        isOpen={showRejectDialog}
      />
    </div>
  );
}
