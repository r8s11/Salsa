interface Props {
  onReset: () => void;
}

export default function SuccessCard({ onReset }: Props) {
  return (
    <section className="submit-event">
      <div className="container">
        <div className="success-card">
          <h2>🎉 Event Submitted!</h2>
          <p>
            Thank you for contributing to the dance community! Your event is now pending review
            and will appear on the calendar once approved.
          </p>
          <button className="btn-primary" onClick={onReset}>
            Submit Another Event
          </button>
        </div>
      </div>
    </section>
  );
}
