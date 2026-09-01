import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import SalsaSeguraLogo from "../components/brand/SalsaSeguraLogo";
import { useAuth } from "../contexts/useAuth";
import { setAuthReturnDestination } from "../lib/authReturnDestination";
import { useFounderOnboarding } from "../hooks/useFounderOnboarding";
import "./FoundersWelcomePage.css";

/**
 * Phase 8 — canonical post-provisioning destination (spec §3).
 *
 * Every rendered state is derived from `founder_onboarding_state()`
 * (database-verified), never from a query parameter, session flag, or
 * navigation state. Revisiting this URL at any time — after a browser
 * restart, on a different device, days later — re-derives the same
 * answer from current database state (spec §8/§9/§31).
 *
 * This route grants no permission by itself. `/host` remains reachable
 * directly at any time via RequireOrganizer + organizer_members; this
 * page is UX guidance, not an authorization dependency.
 *
 * Confirmed capabilities only (spec §5) — verified against the actual
 * Host route table in App.tsx before writing this copy:
 *   - HostCreateEventPage / HostEditEventPage -> "create and edit events"
 *   - HostAttendeeListPage / HostCheckInPage  -> "track attendance"
 *   - HostOrganizationPage                    -> "manage your organization profile"
 * Nothing about analytics, team management, billing, or messaging is
 * claimed — none of those exist yet.
 */
export default function FoundersWelcomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emailRequestedRef = useRef(false);

  // Terminal states so the auto-provision effect can never loop: "pending"
  // guards against a second concurrent attempt, "done"/"failed" guard
  // against re-firing while stale query data still reads
  // accepted_not_provisioned during/after a refetch. Only an explicit
  // "Try Again" click resets this back to "idle".
  const [provisionAttempt, setProvisionAttempt] = useState<"idle" | "pending" | "done" | "failed">(
    "idle"
  );

  const {
    state: resolved,
    isLoading: stateLoading,
    isError: stateIsError,
    refetch,
    provision,
    requestWelcomeEmail,
  } = useFounderOnboarding();

  const goSignIn = useCallback(() => {
    setAuthReturnDestination("/founders/welcome");
    navigate("/signin", { state: { from: "/founders/welcome", mode: "signin" } });
  }, [navigate]);

  useEffect(() => {
    if (authLoading || user) return;
    goSignIn();
  }, [authLoading, user, goSignIn]);

  const needsProvisioning = resolved?.state === "accepted_not_provisioned";

  // Auto-provision on landing in the accepted-not-provisioned state — this
  // IS "the Phase 7 provisioning path" (spec §31): the same route, a
  // distinct in-progress sub-state, re-triggerable on every visit rather
  // than a one-time flag, so an interrupted session (closed tab, network
  // blip, browser restart) is always recoverable by revisiting this URL.
  useEffect(() => {
    if (!needsProvisioning || provisionAttempt !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState in useEffect is standard React; the idle-only guard above prevents redundant/looping updates
    setProvisionAttempt("pending");
    provision()
      .then(() => {
        setProvisionAttempt("done");
      })
      .catch(() => {
        setProvisionAttempt("failed");
      });
  }, [needsProvisioning, provisionAttempt, provision]);

  // Fire the (optional) welcome email exactly once per mount, only once the
  // resolver confirms real provisioned state — never from a bare page load
  // for any other state (spec §15/§20). Idempotent server-side regardless.
  useEffect(() => {
    if (resolved?.state !== "provisioned" || emailRequestedRef.current) return;
    emailRequestedRef.current = true;
    void requestWelcomeEmail();
  }, [resolved?.state, requestWelcomeEmail]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [resolved?.state, provisionAttempt, stateLoading, authLoading]);

  const retryProvisioning = () => {
    setProvisionAttempt("idle");
    void refetch();
  };

  let body: ReactNode;

  if (authLoading || (user && stateLoading)) {
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          Checking your account…
        </h1>
        <p className="founders-welcome-muted">Please wait a moment.</p>
      </section>
    );
  } else if (!user) {
    // The redirect effect above is already navigating away; render nothing
    // that could look like a flash of content.
    body = null;
  } else if (stateIsError) {
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          We couldn&apos;t load your account
        </h1>
        <p className="founders-welcome-detail">Please try again in a moment.</p>
        <div className="founders-welcome-actions">
          <button type="button" className="btn-primary" onClick={() => void refetch()}>
            Try Again
          </button>
        </div>
      </section>
    );
  } else if (resolved?.state === "not_founder") {
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          No Founder invitation found
        </h1>
        <p className="founders-welcome-detail">
          We couldn&apos;t find a completed Founder invitation for this account. If you were
          expecting to see your organization here, check that you&apos;re signed in with the right
          account, or start a new request.
        </p>
        <Link to="/founders" className="btn-secondary founders-welcome-home">
          Request Founder access
        </Link>
      </section>
    );
  } else if (resolved?.state === "manual_resolution_required") {
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          Your account needs a quick check from our team
        </h1>
        <p className="founders-welcome-detail">
          Something about your organization setup needs a look from SalsaSegura before we can show
          your Host Dashboard. <Link to="/contact">Contact SalsaSegura</Link> and we&apos;ll sort it
          out.
        </p>
      </section>
    );
  } else if (needsProvisioning && provisionAttempt === "failed") {
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          We couldn&apos;t finish setting up your organization
        </h1>
        <p className="founders-welcome-detail">Please try again in a moment.</p>
        <div className="founders-welcome-actions">
          <button type="button" className="btn-primary" onClick={retryProvisioning}>
            Try Again
          </button>
        </div>
      </section>
    );
  } else if (needsProvisioning) {
    // Covers idle (about to start), pending (RPC in flight), and done
    // (succeeded, waiting for the invalidated query to refetch as
    // "provisioned"). All three are the same "hold on" moment to the user.
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          Setting up your organization…
        </h1>
        <p className="founders-welcome-muted">This only takes a moment.</p>
      </section>
    );
  } else if (resolved?.state === "provisioned") {
    body = (
      <section className="founders-welcome-card founders-welcome-card--success" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          Welcome to SalsaSegura
        </h1>
        <p className="founders-welcome-org">{resolved.organizationName}</p>
        <p className="founders-welcome-detail">
          Your organization is ready. You&apos;re the <strong>Owner</strong> of{" "}
          {resolved.organizationName} on SalsaSegura, with full Host access.
        </p>
        <ul className="founders-welcome-capabilities">
          <li>Create and edit your event listings</li>
          <li>Track attendance and check attendees in at the door</li>
          <li>Manage your organization&apos;s profile</li>
        </ul>
        <div className="founders-welcome-actions">
          <Link to="/host" className="btn-primary">
            Go to Host Dashboard
          </Link>
          <Link to="/host/events" className="btn-secondary">
            View Your Events
          </Link>
        </div>
      </section>
    );
  } else {
    // Defensive fallback — every state founder_onboarding_state() can
    // return is handled above. Never renders in practice; never a fake
    // success if it somehow does.
    body = (
      <section className="founders-welcome-card" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1}>
          We couldn&apos;t confirm your account status
        </h1>
        <p className="founders-welcome-detail">
          <Link to="/contact">Contact SalsaSegura</Link> if this keeps happening.
        </p>
      </section>
    );
  }

  return (
    <main className="founders-welcome-page">
      <header className="founders-welcome-header">
        <Link className="founders-welcome-logo" to="/" aria-label="Salsa Segura home">
          <SalsaSeguraLogo variant="full" size="lg" tone="brand" />
        </Link>
      </header>

      <div className="founders-welcome-content">{body}</div>

      <footer className="founders-welcome-footer">
        <Link to="/" className="founders-welcome-footer-link">
          ← Back to SalsaSegura
        </Link>
      </footer>
    </main>
  );
}
