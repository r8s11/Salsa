import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="not-found-page">
      <div className="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Oops! Looks like this page took a wrong turn on the dance floor.</p>
        <Link to="/" className="btn-primary">
          🏠 Back to Home
        </Link>
      </div>
    </section>
  );
}
