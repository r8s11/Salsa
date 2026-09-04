import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import AdminPageHeader from "../../components/Admin/AdminPageHeader";
import AdminViewTabs from "../../components/Admin/AdminViewTabs";
import AdminSubmissionsTable, {
  type SubmissionRowAction,
} from "../../components/Admin/AdminSubmissionsTable";
import AdminSubmissionsFilterDrawer, {
  type SubmissionFilters,
} from "../../components/Admin/AdminSubmissionsFilterDrawer";
import AdminRejectSubmissionDialog from "../../components/Admin/AdminRejectSubmissionDialog";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import { type EventSubmission } from "../../features/admin/model/submissions";
import { notifySubmissionRejected } from "../../features/submit-event/submissionNotification";
import "./AdminSubmissionsPage.css";

type SubmissionView = "pending" | "in_review" | "needs_information" | "all";

const SUBMISSION_VIEWS: { view: SubmissionView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "in_review", label: "In Review" },
  { view: "needs_information", label: "Needs Information" },
  { view: "all", label: "All" },
];

/**
 * Supabase rejects with a PostgrestError, which is a plain object rather than
 * an Error — falling back to `null` here would hide a failed rejection behind
 * an open dialog, so unknown failures still get a message.
 */
function rejectionErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || "Rejection failed.";
  }
  return "Rejection failed.";
}

export default function AdminSubmissionsPage() {
  const navigate = useNavigate();
  const { submissions, isLoading, error, updateSubmission, isUpdating, updateError } =
    useAdminSubmissions();
  const [rejectingSubmission, setRejectingSubmission] = useState<EventSubmission | null>(null);
  const [filters, setFilters] = useState<SubmissionFilters>({
    status: null,
    submitter_name: null,
  });
  const [view, setView] = useState<SubmissionView>("pending");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const counts: Record<SubmissionView, number> = {
    pending: submissions.filter((submission) => submission.status === "pending").length,
    in_review: submissions.filter((submission) => submission.status === "in_review").length,
    needs_information: submissions.filter((submission) => submission.status === "needs_information")
      .length,
    all: submissions.length,
  };

  const filteredSubmissions = submissions.filter((submission) => {
    if (view !== "all" && submission.status !== view) return false;
    if (filters.status && submission.status !== filters.status) return false;
    if (filters.submitter_name && submission.submitter_name !== filters.submitter_name)
      return false;
    return true;
  });

  const activeFilterCount =
    Number(Boolean(filters.status)) + Number(Boolean(filters.submitter_name));

  const handleViewChange = (nextView: SubmissionView) => {
    setView(nextView);
    if (nextView !== "all" && filters.status) {
      setFilters({ ...filters, status: null });
    }
  };

  const handleFiltersChange = (nextFilters: SubmissionFilters) => {
    setFilters(nextFilters);
    if (nextFilters.status) setView("all");
  };

  const handleAction = (action: SubmissionRowAction, submission: EventSubmission) => {
    switch (action) {
      case "approve":
      case "view":
        navigate(`/admin/submissions/${submission.id}`);
        break;
      case "reject":
        setRejectingSubmission(submission);
        break;
    }
  };

  const handleRejectConfirm = (reason: string, message: string, note: string) => {
    if (!rejectingSubmission) return;
    updateSubmission(
      {
        id: rejectingSubmission.id,
        update: {
          status: "rejected",
          rejection_reason: reason as EventSubmission["rejection_reason"],
          rejection_message: message || undefined,
          internal_note: note || undefined,
        },
      },
      {
        onSuccess: () => {
          // Only after the rejection committed. The email carries
          // rejection_message only — internal_note never leaves the admin UI.
          void notifySubmissionRejected(rejectingSubmission.id);
          setRejectingSubmission(null);
        },
      }
    );
  };

  const emptyMessage =
    view === "pending"
      ? "No submissions are waiting to be reviewed."
      : view === "in_review"
        ? "No submissions are currently in review."
        : view === "needs_information"
          ? "No submissions are waiting for more information."
          : "No submissions match these filters.";

  return (
    <div className="admin-submissions-page">
      <AdminPageHeader
        title="Submissions"
        description="Review community-submitted events before they reach the calendar."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--sm"
            onClick={() => setDrawerOpen(true)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="admin-submissions-page__filter-count">{activeFilterCount}</span>
            )}
          </button>
        }
      />

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          Submissions could not be loaded. Try refreshing the page.
        </div>
      )}

      {!error && (
        <>
          <AdminViewTabs
            views={SUBMISSION_VIEWS}
            active={view}
            counts={counts}
            panelId="admin-submissions-tabpanel"
            ariaLabel="Submission review queue"
            selectId="admin-submissions-view-select"
            selectLabel="Submission review queue"
            onChange={handleViewChange}
          />

          <p className="admin-submissions-page__result-count" role="status">
            {filteredSubmissions.length} submission
            {filteredSubmissions.length === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-submissions-page__table-card"
            id="admin-submissions-tabpanel"
            role="tabpanel"
            aria-labelledby={`admin-view-tab-${view}`}
          >
            {isLoading ? (
              <div className="admin-submissions-page__loading" aria-busy="true">
                <p role="status">Loading submissions…</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="admin-submissions-page__empty">
                <h2>{emptyMessage}</h2>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost admin-btn--sm"
                    onClick={() => handleFiltersChange({ status: null, submitter_name: null })}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <AdminSubmissionsTable
                submissions={filteredSubmissions}
                onAction={handleAction}
                busy={rejectingSubmission ? false : isUpdating}
                error={rejectingSubmission ? null : rejectionErrorMessage(updateError)}
              />
            )}
          </div>
        </>
      )}

      <AdminSubmissionsFilterDrawer
        open={drawerOpen}
        submissions={submissions}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setDrawerOpen(false)}
      />

      {rejectingSubmission && (
        <AdminRejectSubmissionDialog
          submissionId={rejectingSubmission.id}
          submissionLabel={(rejectingSubmission.submitted_data?.title as string) || null}
          isBusy={isUpdating}
          error={rejectionErrorMessage(updateError)}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectingSubmission(null)}
        />
      )}
    </div>
  );
}
