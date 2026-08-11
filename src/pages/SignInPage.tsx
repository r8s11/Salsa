import { Link } from "react-router-dom";
import SignInForm from "../components/Auth/SignInForm";
import "./SignInPage.css";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link className="auth-logo" to="/" aria-label="Salsa Segura home">
        Salsa Segura
      </Link>
      <div className="auth-shell">
        <section className="auth-story" aria-labelledby="auth-story-heading">
          <p className="auth-story-eyebrow">Salsa Segura account</p>
          <h1 id="auth-story-heading">Your city. Your rhythm. Your calendar.</h1>
          <p>
            Sign in to submit events, track moderation status, and help keep
            the dance floor moving.
          </p>
        </section>
        <SignInForm />
      </div>
    </main>
  );
}
