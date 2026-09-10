import Button from "../../../components/ui/Button";

interface Props {
  onReset: () => void;
}

export default function SuccessCard({ onReset }: Props) {
  return (
    <section className="submit-event">
      <div className="container">
        <div className="success-card">
          <h2><span aria-hidden="true">🎉</span> Event Submitted!</h2>
          <p>
            Thank you for contributing to the dance community! Your event is now pending review and
            will appear on the calendar once approved.
          </p>
          <Button onClick={onReset}>
            Submit Another Event
          </Button>
        </div>
      </div>
    </section>
  );
}
