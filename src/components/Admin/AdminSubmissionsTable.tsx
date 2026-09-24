import { useMemo } from "react";
import { CalendarDays, Clock, MapPin, User, Mail } from "lucide-react";
import { type EventSubmission } from "../../features/admin/model/submissions";
import { resolveEventFlyer } from "../EventModal/eventModalImage";
import AdminSubmissionStatusBadge from "./AdminSubmissionStatusBadge";
import AdminActionMenu from "./AdminActionMenu";
import "./AdminSubmissionsTable.css";

import "./AdminTables.css";

export type SubmissionRowAction = "approve" | "reject" | "view" | "edit";

interface AdminSubmissionsTableProps {
  submissions: EventSubmission[];
  onAction: (action: SubmissionRowAction, submission: EventSubmission) => void;
  busy?: boolean;
  errorId?: string | null;
  error?: string | null;
  isLoading?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SubmissionCell({ submission }: { submission: EventSubmission }) {
  const title = (submission.submitted_data?.title as string) || "Untitled Event";
  const date = submission.submitted_data?.event_date as string | undefined;
  const location = submission.submitted_data?.location as string | undefined;
  const imageUrl = submission.submitted_data?.image_url as string | undefined;
  const rawStyles = submission.submitted_data?.dance_styles;
  const danceStyles = Array.isArray(rawStyles)
    ? rawStyles.filter((style): style is string => typeof style === "string")
    : [];

  return (
    <div className="admin-submissions-table__event">
      <img
        className="admin-submissions-table__flyer"
        src={resolveEventFlyer({
          imageUrl: imageUrl ?? "",
          calendarId: submission.submitted_data?.event_type as string | undefined,
          danceStyles,
        })}
        alt=""
        loading="lazy"
        width={48}
        height={60}
      />
      <div className="admin-submissions-table__event-copy">
        <div className="admin-submissions-table__title">{title}</div>
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
        {(date || location) && (
          <div className="admin-submissions-table__event-facts">
            {date && (
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                {new Date(date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {location && (
              <span>
                <MapPin size={14} aria-hidden="true" />
                {location}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSubmissionsTable({
  submissions,
  onAction,
  busy,
  error,
  isLoading = false,
}: AdminSubmissionsTableProps) {
  const actionItemsBySubmissionId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label: string; onSelect: () => void }>>();
    for (const sub of submissions) {
      map.set(sub.id, [
        { id: "view", label: "View Details", onSelect: () => onAction("view", sub) },
        { id: "approve", label: "Approve", onSelect: () => onAction("approve", sub) },
        { id: "reject", label: "Reject", onSelect: () => onAction("reject", sub) },
      ]);
    }
    return map;
  }, [submissions, onAction]);

  if (isLoading) {
    return (
      <div className="admin-submissions-table-container" aria-busy="true">
        <table className="admin-submissions-table">
          <caption className="admin-visually-hidden">Event submissions — loading</caption>
          <thead>
            <tr>
              <th scope="col">Event Details</th>
              <th scope="col">Status</th>
              <th scope="col">Submitted At</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="admin-submissions-table__loading-row">
                <td colSpan={4}>
                  <div className="admin-table-loading">
                    <div className="admin-skeleton admin-skeleton--title"></div>
                    <div className="admin-skeleton admin-skeleton--meta"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="admin-table-empty" role="status">
        <p>No submissions found.</p>
      </div>
    );
  }
  return (
    <div className="admin-submissions-table-container">
      {error && <div className="admin-banner admin-banner--error">{error}</div>}
      <table className="admin-submissions-table">
        <caption className="admin-visually-hidden">Event submissions</caption>
        <thead>
          <tr>
            <th scope="col">Event Details</th>
            <th scope="col">Status</th>
            <th scope="col">Submitted At</th>
            <th scope="col" className="admin-submissions-table__actions-header">
              Actions
            </th>
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
                  <Clock size={14} aria-hidden="true" />
                  {formatDate(submission.submitted_at)}
                </div>
              </td>
              <td className="admin-submissions-table__actions">
                <AdminActionMenu
                  label={`Actions for ${submission.submitted_data?.title || "submission"}`}
                  items={actionItemsBySubmissionId.get(submission.id)!}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
