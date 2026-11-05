import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import EntityLinkSummary from "../../entity-matching/EntityLinkSummary";
import type { EntityReview } from "../../entity-matching/entityReview";
import { listReviewEntries } from "../../entity-matching/entityReviewState";

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
}

export default function SuccessCard({ onReset, trackPath = null, links = null }: Props) {
  const hasLinks = Boolean(links && listReviewEntries(links).length > 0);
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
