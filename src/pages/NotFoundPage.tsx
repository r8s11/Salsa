import { Home } from "lucide-react";
import ButtonLink from "../components/ui/ButtonLink";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";

export default function NotFoundPage() {
  useDocumentMeta({
    title: "Page not found",
    description: "This page is not available. Explore approved dance events and communities on Salsa Segura.",
    robots: "noindex, follow",
  });
  return (
    <section className="not-found-page">
      <div className="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Oops! Looks like this page took a wrong turn on the dance floor.</p>
        <ButtonLink to="/" variant="primary">
          <Home size={16} aria-hidden="true" /> Back to Home
        </ButtonLink>
      </div>
    </section>
  );
}
