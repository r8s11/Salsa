import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AdminFounderRequestsTable from "../../features/admin/components/AdminFounderRequestsTable";
import AdminFounderRequestsFilterDrawer from "../../features/admin/components/AdminFounderRequestsFilterDrawer";
import AdminApproveDialog from "../../features/admin/components/AdminApproveDialog";
import AdminRejectFounderDialog from "../../features/admin/components/AdminRejectFounderDialog";
import { useFounderRequests } from "../../features/admin/hooks/useFounderRequests";
import {
  applyFounderRequestView,
  applyFounderRequestFilters,
  applyFounderRequestSort,
  founderRequestViewCounts,
  type FounderRequestView,
  type FounderRequestFilters,
  type FounderRequestSort,
  type FounderAccessRequestRow,
} from "../../features/admin/model/founderRequestsQuery";
import "./AdminFounderRequestsPage.css";

export default function AdminFounderRequestsPage() {
  const navigate = useNavigate();
  const {
    requests: allRequests,
    isLoading,
    isAdmin,
    approveAndSendInvitation,
    isApprovingAndSending,
    approveAndSendInvitationError,
    approveAndSendInvitationResult,
    rejectRequest,
    isRejecting,
  } = useFounderRequests();

  const [filters, setFilters] = useState<FounderRequestFilters>({ status: "all", search: "" });
  const [sort, setSort] = useState<FounderRequestSort>({ key: "requested", dir: "desc" });
  const [view, setView] = useState<FounderRequestView>("pending");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const filteredRequests = applyFounderRequestSort(
    applyFounderRequestView(applyFounderRequestFilters(allRequests, filters), view),
    sort
  );

  const counts = founderRequestViewCounts(allRequests);

  const handleAction = (
    action: "view" | "approve" | "reject",
    request: FounderAccessRequestRow
  ) => {
    switch (action) {
      case "view":
        navigate(`/admin/founder-requests/${request.id}`);
        break;
      case "approve":
        setSelectedRequestId(request.id);
        setShowApproveDialog(true);
        break;
      case "reject":
        setSelectedRequestId(request.id);
        setShowRejectDialog(true);
        break;
    }
  };

  const handleApprove = (requestId: string) => {
    approveAndSendInvitation(requestId, {
      onSuccess: () => {
        setShowApproveDialog(false);
        setSelectedRequestId(null);
      },
    });
  };

  const handleReject = (requestId: string, reasonCode: string, message: string) => {
    rejectRequest(
      { requestId, reasonCode, message },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setSelectedRequestId(null);
        },
      }
    );
  };

  return (
    <div className="admin-founder-requests-page">
      <header className="page-header">
        <div className="header-content">
          <h1>Founder Requests</h1>
          <div className="header-badges">
            <button
              type="button"
              className={`status-tab ${view === "pending" ? "active" : ""}`}
              onClick={() => setView("pending")}
            >
              Pending <span className="badge">{counts.pending}</span>
            </button>
            <button
              type="button"
              className={`status-tab ${view === "approved" ? "active" : ""}`}
              onClick={() => setView("approved")}
            >
              Approved <span className="badge">{counts.approved}</span>
            </button>
            <button
              type="button"
              className={`status-tab ${view === "rejected" ? "active" : ""}`}
              onClick={() => setView("rejected")}
            >
              Rejected <span className="badge">{counts.rejected}</span>
            </button>
            <button
              type="button"
              className={`status-tab ${view === "all" ? "active" : ""}`}
              onClick={() => setView("all")}
            >
              All <span className="badge">{counts.all}</span>
            </button>
          </div>
        </div>

        <div className="page-actions">
          <button type="button" className="filter-btn" onClick={() => setFilterDrawerOpen(true)}>
            <span className="icon">🔍</span>
            Filters
          </button>
        </div>
      </header>

      <div className="page-main">
        {approveAndSendInvitationError && (
          <div className="result-message result-message--error" role="alert">
            {approveAndSendInvitationError instanceof Error
              ? approveAndSendInvitationError.message
              : "An error occurred during approval."}
          </div>
        )}

        {approveAndSendInvitationResult && (
          <div className="result-message result-message--success" role="status">
            {approveAndSendInvitationResult.invitationResult?.deliveryStatus === "attempting"
              ? "Request approved. Invitation email is being sent."
              : `Request approved. Invitation email sent to ${approveAndSendInvitationResult.invitationResult?.email}.`}
          </div>
        )}

        {isLoading ? (
          <div className="loading-state">
            <Loader2 className="spinner" />
            <p>Loading founder requests…</p>
          </div>
        ) : (
          <>
            <AdminFounderRequestsTable
              requests={filteredRequests}
              onAction={handleAction}
              isLoading={false}
              isAdmin={isAdmin}
            />
            {filteredRequests.length === 0 && (
              <div className="empty-state">
                <p>
                  {view === "pending"
                    ? "No pending founder requests."
                    : view === "approved"
                    ? "No approved founder requests yet."
                    : view === "rejected"
                    ? "No rejected founder requests yet."
                    : "No founder requests found."}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <AdminFounderRequestsFilterDrawer
        open={filterDrawerOpen}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={filteredRequests.length}
        onClose={() => setFilterDrawerOpen(false)}
      />

      <AdminApproveDialog
        requestId={selectedRequestId ?? ""}
        isBusy={isApprovingAndSending}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveDialog(false)}
        isOpen={showApproveDialog}
      />

      <AdminRejectFounderDialog
        requestId={selectedRequestId ?? ""}
        isBusy={isRejecting}
        onConfirm={handleReject}
        onCancel={() => setShowRejectDialog(false)}
        isOpen={showRejectDialog}
      />
    </div>
  );
}
