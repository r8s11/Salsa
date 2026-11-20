import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import EntityLinkSummary from "../../entity-matching/EntityLinkSummary";
import type { EntityReview } from "../../entity-matching/entityReview";
import { listReviewEntries } from "../../entity-matching/entityReviewState";
import type {
  AutoPublishBlockReason,
  PublishOwnSubmissionResult,
} from "../../admin/api/submissionsRepo";

interface Props {
  onReset: () => void;
  /**
   * Where this submitter can watch the pending submission. Only signed-in
   * submitters have such a page, so anonymous submissions pass null and the
   * link is omitted rather than pointing at a view they cannot open.
   */
  trackPath?: string | null;
  /** The venue, organizer, instructor and school links exactly as submitted. */
  links?: EntityReview | null;
  /** Signed-in submissions only: published straight away, or why it went to review. */
  outcome?: PublishOwnSubmissionResult | null;
}

// Only reasons the member can act on or would wonder about get a sentence.
const REVIEW_REASON: Partial<Record<AutoPublishBlockReason, string>> = {
  email_unverified: "Confirm your email address to publish events straight away next time.",
  daily_limit: "You've reached today's limit for publishing straight away, so this one goes to review.",
  recurring: "Repeating events are checked by a moderator before they go live.",
  needs_review: "This one needs a quick check before it goes live.",
};

export default function SuccessCard({ onReset, trackPath = null, links = null, outcome = null }: Props) {
  const hasLinks = Boolean(links && listReviewEntries(links).length > 0);

  if (outcome?.published === "unconfirmed") {
    return (
      <section className="submit-event">
        <div className="container">
          <div className="success-card">
            <h2>
              <CheckCircle2 size={22} aria-hidden="true" /> Event Saved
            </h2>
            <p>
              We saved your event but couldn't confirm whether it's live yet. Check your submissions
              in a moment; there's no need to submit it again.
            </p>
            {trackPath && (
              <p className="success-card__track">
                <Link to={trackPath}>Check your submissions</Link>
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (outcome?.published === true) {
    return (
      <section className="submit-event">
        <div className="container">
          <div className="success-card">
            <h2>
              <CheckCircle2 size={22} aria-hidden="true" /> Event Published!
            </h2>
            <p>Your event is live on the calendar. Thank you for adding it to the dance community!</p>
            {hasLinks && (
              <EntityLinkSummary
                review={links}
                mode="public"
                heading="Sent with your event"
                headingLevel={3}
                pendingNote="A moderator can add these links afterwards."
              />
            )}
            <Button onClick={onReset}>Submit Another Event</Button>
            <p className="success-card__track">
              <Link to={`/events/${outcome.eventId}`}>View your event</Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  const reviewReason = outcome?.published === false ? REVIEW_REASON[outcome.reason] : undefined;
  return (
    <section className="submit-event">
      <div className="container">
        <div className="success-card">
          <h2>
            <CheckCircle2 size={22} aria-hidden="true" /> Event Submitted!
          </h2>
          <p>
            Thank you for contributing to the dance community! Your event is now pending review and
            will appear on the calendar once approved.
          </p>
          {reviewReason && <p>{reviewReason}</p>}
          {hasLinks && (
            <EntityLinkSummary
              review={links}
              mode="public"
              heading="Sent with your event"
              headingLevel={3}
              pendingNote="A moderator decides what to link for these."
            />
          )}
          <Button onClick={onReset}>Submit Another Event</Button>
          {trackPath && (
            <p className="success-card__track">
              <Link to={trackPath}>See your pending submission</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
