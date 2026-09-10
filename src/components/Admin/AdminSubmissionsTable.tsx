import { Clock, User, Mail } from "lucide-react";
import { type EventSubmission } from "../../features/admin/model/submissions";
import AdminSubmissionStatusBadge from "./AdminSubmissionStatusBadge";
import AdminActionMenu from "./AdminActionMenu";
import "./AdminSubmissionsTable.css";

export type SubmissionRowAction = "approve" | "reject" | "view" | "edit";

interface AdminSubmissionsTableProps {
  submissions: EventSubmission[];
  onAction: (action: SubmissionRowAction, submission: EventSubmission) => void;
  busy?: boolean;
  errorId?: string | null;
  error?: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SubmissionCell({ submission }: { submission: EventSubmission }) {
  return (
    <div className="admin-submissions-table__event">
      <div className="admin-submissions-table__title">
        {(submission.submitted_data?.title as string) || "Untitled Event"}
      </div>
      <div className="admin-submissions-table__meta">
        <span>
          <User size={14} aria-hidden="true" />
          {submission.submitter_name || "Anonymous"}
        </span>
        <span>
          <Mail size={14} aria-hidden="true" />
          {submission.submitter_email || "No email"}
        </span>
      </div>
    </div>
  );
}

export default function AdminSubmissionsTable({
  submissions,
  onAction,
  busy,
  error,
}: AdminSubmissionsTableProps) {
  return (
    <div className="admin-submissions-table-container">
      {error && <div className="admin-banner admin-banner--error">{error}</div>}
      <table className="admin-submissions-table">
        <thead>
          <tr>
            <th>Event Details</th>
            <th>Status</th>
            <th>Submitted At</th>
            <th className="admin-submissions-table__actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id} className={busy ? "admin-submissions-table__row--busy" : ""}>
              <td>
                <SubmissionCell submission={submission} />
              </td>
              <td>
                <AdminSubmissionStatusBadge status={submission.status} />
              </td>
              <td>
                <div className="admin-submissions-table__date">
                  <Clock size={14} />
                  {formatDate(submission.submitted_at)}
                </div>
              </td>
              <td className="admin-submissions-table__actions">
                <AdminActionMenu
                  label={`Actions for ${submission.submitted_data?.title || "submission"}`}
                  items={[
                    {
                      id: "view",
                      label: "View Details",
                      onSelect: () => onAction("view", submission),
                    },
                    {
                      id: "approve",
                      label: "Approve",
                      onSelect: () => onAction("approve", submission),
                    },
                    {
                      id: "reject",
                      label: "Reject",
                      onSelect: () => onAction("reject", submission),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
