import { Link } from "react-router-dom";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissionList";
import { submissionLinkSource } from "../../../entity-matching/entityReviewState";

type LinkableKind = "organizer" | "school" | "instructor";

const submittedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Pending submissions whose venue/organizer/instructor/school review picks
 * this record. Approval links them, so the record page says so before it
 * happens. Silent while loading and when there are none.
 */
export default function AdminEntityPendingSubmissions({
  kind,
  id,
  singular,
}: {
  kind: LinkableKind;
  id: string;
  singular: string;
}) {
  const { submissions, error } = useAdminSubmissions();
  const linking = submissions.flatMap((submission) => {
    const source = submissionLinkSource(
      submission.submitted_data.entity_review,
      submission.edited_data?.entity_review,
      kind,
      id
    );
    return source ? [{ submission, source }] : [];
  });

  if (error) {
    return (
      <p className="admin-entity-page__quiet" role="status">
        Couldn’t check pending submissions for links to this {singular.toLowerCase()}.
      </p>
    );
  }
  if (linking.length === 0) return null;
  return (
    <section className="admin-card admin-entity-page__linked" aria-labelledby="entity-submissions-title">
      <h2 id="entity-submissions-title">
        Pending submissions linking it <span>({linking.length})</span>
      </h2>
      <ul>
        {linking.map(({ submission, source }) => {
          const title = submission.submitted_data.title;
          return (
            <li key={submission.id}>
              <Link className="admin-entity-page__event" to={`/admin/submissions/${submission.id}`}>
                {typeof title === "string" && title.trim() ? title : "Untitled submission"}
              </Link>
              <span className="admin-entity-page__event-meta">
                <time dateTime={submission.submitted_at}>
                  {submittedAt.format(new Date(submission.submitted_at))}
                </time>
                <span className="admin-entity-page__event-status">
                  {source === "moderator" ? "Moderator linked it" : "Submitter suggested it"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
