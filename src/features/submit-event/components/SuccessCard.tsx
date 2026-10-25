import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Button from "../../../components/ui/Button";

interface Props {
  onReset: () => void;
  /**
   * Where this submitter can watch the pending submission. Only signed-in
   * submitters have such a page, so anonymous submissions pass null and the
   * link is omitted rather than pointing at a view they cannot open.
   */
  trackPath?: string | null;
}

export default function SuccessCard({ onReset, trackPath = null }: Props) {
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
