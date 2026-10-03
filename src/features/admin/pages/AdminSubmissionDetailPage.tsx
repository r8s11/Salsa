import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarDays, Clock3, FileText, MapPin, UserRound } from "lucide-react";
import { useActiveTaxonomyTerms } from "../hooks/useAdminTaxonomy";
import { useAdminSubmissions } from "../hooks/useAdminSubmissionList";
import AdminRejectSubmissionDialog from "../../../components/Admin/AdminRejectSubmissionDialog";
import AdminSubmissionStatusBadge from "../../../components/Admin/AdminSubmissionStatusBadge";
import { resolveEventFlyer } from "../../../components/EventModal/eventModalImage";
import EntityReviewSection from "../../entity-matching/EntityReviewSection";
import type { EntityReview } from "../../entity-matching/entityReview";
import { moderatorStartingReview } from "../../entity-matching/entityReviewState";
import type { EventSubmission } from "../model/submissions";
import {
  notifySubmissionApproved,
  notifySubmissionRejected,
} from "../../submit-event/api/submissionNotification";
import "./AdminSubmissionDetailPage.css";

function textValue(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function formatEventDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [taxonomyTermIds, setTaxonomyTermIds] = useState<string[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const {
    submissions,
    isLoading,
    error,
    approveSubmissionWithTaxonomy,
    isApproving,
    approveError,
    updateSubmission,
    updateSubmissionAsync,
    isUpdating,
    updateError,
  } = useAdminSubmissions();
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const submission = useMemo(() => submissions.find((item) => item.id === id), [submissions, id]);
  const { review: initialReview, demoted: submittedReviewDemoted } = useMemo(
    () =>
      moderatorStartingReview(
        submission?.submitted_data.entity_review,
        submission?.edited_data?.entity_review
      ),
    [submission]
  );
  const [reviewEdit, setReviewEdit] = useState<EntityReview | null>(null);
  const review = reviewEdit ?? initialReview;

  if (isLoading) return <div className="admin-submission-detail-page">Loading...</div>;
  if (error)
    return (
      <div className="admin-submission-detail-page" role="alert">
        Error loading submission.
      </div>
    );
  if (!submission) return <div className="admin-submission-detail-page">Submission not found.</div>;

  const rawStyles = Array.isArray(submission.submitted_data.dance_styles)
    ? submission.submitted_data.dance_styles.filter(
        (style): style is string => typeof style === "string"
      )
    : [];
  const title = textValue(submission.submitted_data, "title") ?? "Untitled event";
  const eventDate = formatEventDate(textValue(submission.submitted_data, "event_date"));
  const eventTime = textValue(submission.submitted_data, "event_time");
  const location = textValue(submission.submitted_data, "location");
  const address = textValue(submission.submitted_data, "address");
  const description = textValue(submission.submitted_data, "description");
  const imageUrl = textValue(submission.submitted_data, "image_url") ?? "";
  const toggleTerm = (termId: string) =>
    setTaxonomyTermIds((current) =>
      current.includes(termId) ? current.filter((id) => id !== termId) : [...current, termId]
    );
  const approve = async () => {
    // A moderator's edits to the linked records are saved to edited_data
    // before approval so the approval reads exactly what was reviewed.
    if (reviewEdit) {
      try {
        await updateSubmissionAsync({
          id: submission.id,
          update: { edited_data: { ...(submission.edited_data ?? {}), entity_review: reviewEdit } },
        });
      } catch {
        return; // updateError is shown below; nothing was approved.
      }
    }
    approveSubmissionWithTaxonomy(
      { submissionId: submission.id, taxonomyTermIds },
      {
        onSuccess: () => {
          void notifySubmissionApproved(submission.id);
          navigate("/admin/submissions");
        },
      }
    );
  };
  const reject = (reason: string, message: string, note: string) => {
    updateSubmission(
      {
        id: submission.id,
        update: {
          status: "rejected",
          rejection_reason: reason as EventSubmission["rejection_reason"],
          rejection_message: message || undefined,
          internal_note: note || undefined,
        },
      },
      {
        onSuccess: () => {
          void notifySubmissionRejected(submission.id);
          navigate("/admin/submissions");
        },
      }
    );
  };

  return (
    <div className="admin-submission-detail-page">
      <header className="admin-submission-detail-page__header">
        <button
          type="button"
          onClick={() => navigate("/admin/submissions")}
          className="admin-btn admin-btn--ghost"
        >
          &larr; Back to Submissions
        </button>
        <div className="admin-submission-detail-page__heading">
          <div>
            <p className="admin-submission-detail-page__eyebrow">Submission review</p>
            <h1>{title}</h1>
            <p className="admin-submission-detail-page__id">
              Submission {submission.id} · Status: {submission.status}
            </p>
          </div>
          <AdminSubmissionStatusBadge status={submission.status} />
        </div>
      </header>

      <div className="admin-submission-detail-page__body">
        <section
          className="admin-card admin-submission-detail-page__overview"
          aria-labelledby="submission-overview-heading"
        >
          <div className="admin-submission-detail-page__flyer-wrap">
            <img
              className="admin-submission-detail-page__flyer"
              src={resolveEventFlyer({
                imageUrl,
                calendarId: textValue(submission.submitted_data, "event_type") ?? undefined,
                danceStyles: rawStyles,
              })}
              alt={`Flyer for ${title}`}
              width={240}
              height={300}
              loading="lazy"
            />
          </div>
          <div className="admin-submission-detail-page__overview-copy">
            <div className="admin-submission-detail-page__section-heading">
              <div>
                <p className="admin-submission-detail-page__eyebrow">Event details</p>
                <h2 id="submission-overview-heading">Review the submitted event</h2>
              </div>
              <FileText size={20} aria-hidden="true" />
            </div>
            <dl className="admin-submission-detail-page__facts">
              <div>
                <dt>
                  <CalendarDays size={15} aria-hidden="true" /> Date
                </dt>
                <dd>
                  {eventDate ?? "Not supplied"}
                  {eventTime ? ` · ${eventTime}` : ""}
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" /> Location
                </dt>
                <dd>
                  {location ?? "Not supplied"}
                  {address ? ` · ${address}` : ""}
                </dd>
              </div>
              <div>
                <dt>
                  <UserRound size={15} aria-hidden="true" /> Submitted by
                </dt>
                <dd>{submission.submitter_name ?? submission.submitter_email ?? "Anonymous"}</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={15} aria-hidden="true" /> Submitted
                </dt>
                <dd>{new Date(submission.submitted_at).toLocaleString()}</dd>
              </div>
            </dl>
            {description && (
              <p className="admin-submission-detail-page__description">{description}</p>
            )}
          </div>
        </section>

        <section
          className="admin-card admin-submission-detail-page__source"
          aria-labelledby="submitted-source-heading"
        >
          <div className="admin-submission-detail-page__section-heading">
            <div>
              <p className="admin-submission-detail-page__eyebrow">Submitted source</p>
              <h2 id="submitted-source-heading">What the community member sent</h2>
            </div>
          </div>
          {rawStyles.length > 0 ? (
            <div
              className="admin-submission-detail-page__chips"
              aria-label="Submitted dance styles"
            >
              {rawStyles.map((style) => (
                <span key={style}>{style}</span>
              ))}
            </div>
          ) : (
            <p className="admin-submission-detail-page__muted">No dance styles were supplied.</p>
          )}
          <details className="admin-submission-detail-page__payload">
            <summary>View submitted payload</summary>
            <pre>{JSON.stringify(submission.submitted_data, null, 2)}</pre>
          </details>
        </section>

        {submission.edited_data && (
          <section
            className="admin-card admin-submission-detail-page__source"
            aria-labelledby="moderator-edits-heading"
          >
            <div className="admin-submission-detail-page__section-heading">
              <div>
                <p className="admin-submission-detail-page__eyebrow">Moderator context</p>
                <h2 id="moderator-edits-heading">Moderator edits</h2>
              </div>
            </div>
            <details className="admin-submission-detail-page__payload" open>
              <summary>View edited payload</summary>
              <pre>{JSON.stringify(submission.edited_data, null, 2)}</pre>
            </details>
          </section>
        )}

        {review && (
          <section
            className="admin-card admin-submission-detail-page__entities"
            aria-label="Venue, organizer, instructors and school"
          >
            {submittedReviewDemoted && (
              <p className="admin-submission-detail-page__muted">
                The submitter can only suggest records. Whatever they chose, an existing record or a
                new one, is shown here as undecided until you confirm it.
              </p>
            )}
            <EntityReviewSection
              review={review}
              onChange={setReviewEdit}
              disabled={isApproving || isUpdating}
              mode="authorized"
            />
          </section>
        )}

        <fieldset className="admin-card admin-submission-detail-page__taxonomy">
          <legend>Canonical dance styles</legend>
          <p className="admin-submission-detail-page__muted">
            Select the taxonomy terms that should be attached when this event is approved.
          </p>
          {danceStyles.isLoading ? (
            <p>Loading dance styles…</p>
          ) : danceStyles.error ? (
            <p role="alert">{danceStyles.error}</p>
          ) : danceStyles.terms.length === 0 ? (
            <p>No active dance styles available</p>
          ) : (
            <div className="admin-submission-detail-page__taxonomy-options">
              {danceStyles.terms.map((term) => (
                <label key={term.id}>
                  <input
                    type="checkbox"
                    checked={taxonomyTermIds.includes(term.id)}
                    onChange={() => toggleTerm(term.id)}
                  />
                  {term.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {(approveError || updateError) && (
          <p className="admin-submission-detail-page__error" role="alert">
            {approveError instanceof Error
              ? approveError.message
              : updateError instanceof Error
                ? updateError.message
                : "Review action failed"}
          </p>
        )}
        <div className="admin-submission-detail-page__actions" aria-label="Submission actions">
          <div>
            <p className="admin-submission-detail-page__eyebrow">Decision</p>
            <strong>Ready to update this submission?</strong>
          </div>
          <div className="admin-submission-detail-page__action-buttons">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={isApproving || isUpdating || danceStyles.isLoading}
              onClick={() => void approve()}
            >
              {isApproving ? "Approving…" : "Approve submission"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              disabled={isApproving || isUpdating}
              onClick={() => setRejectDialogOpen(true)}
            >
              Reject submission
            </button>
          </div>
        </div>
      </div>
      {rejectDialogOpen && (
        <AdminRejectSubmissionDialog
          submissionId={submission.id}
          submissionLabel={title}
          isBusy={isUpdating}
          onConfirm={reject}
          onCancel={() => setRejectDialogOpen(false)}
        />
      )}
    </div>
  );
}
