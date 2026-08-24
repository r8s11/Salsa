import { Clock, User, Mail } from "lucide-react";
import { type EventSubmission } from "../../features/admin/model/submissions";
import AdminStatusBadge from "./AdminStatusBadge";
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
    <div className="submission-cell">
      <div className="submission-title">
        {(submission.submitted_data?.title as string) || "Untitled Event"}
      </div>
      <div className="submission-meta">
        <span className="submitter">
          <User size={14} />
          {submission.submitter_name || "Anonymous"}
        </span>
        <span className="email">
          <Mail size={14} />
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
      {error && <div className="error-banner">{error}</div>}
      <table className="admin-submissions-table">
        <thead>
          <tr>
            <th>Event Details</th>
            <th>Status</th>
            <th>Submitted At</th>
            <th className="actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id} className={busy ? "busy" : ""}>
              <td>
                <SubmissionCell submission={submission} />
              </td>
              <td>
                <AdminStatusBadge status={submission.status} />
              </td>
              <td>
                <div className="date-col">
                  <Clock size={14} />
                  {formatDate(submission.submitted_at)}
                </div>
              </td>
              <td className="actions-col">
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
