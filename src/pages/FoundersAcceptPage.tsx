import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SalsaSeguraLogo from "../components/brand/SalsaSeguraLogo";
import { useAuth } from "../contexts/useAuth";
import {
  validateFounderInvitation,
  acceptFounderInvitation,
  type FounderInvitationValidationResult,
} from "../features/founder/api/founderInvitationAcceptance";
import { provisionFounderOrganization } from "../features/founder/api/founderOnboarding";
import {
  setFounderInvitationToken,
  getFounderInvitationToken,
  clearFounderInvitationToken,
} from "../lib/founderInvitationToken";
import { setAuthReturnDestination } from "../lib/authReturnDestination";
import "./FoundersAcceptPage.css";

type AcceptanceState =
  | { kind: "loading" }
  | { kind: "valid-signed-out"; organizationName: string; invitedEmail: string; expiresAt: string }
  | { kind: "valid-matching"; organizationName: string; invitedEmail: string; expiresAt: string }
  | { kind: "valid-wrong-user"; organizationName: string; invitedEmail: string; expiresAt: string; authEmail: string }
  | { kind: "invalid" }
  | { kind: "accepting"; organizationName: string }
  | { kind: "accepted"; organizationName: string }
  | { kind: "error" };

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export default function FoundersAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [state, setState] = useState<AcceptanceState>({ kind: "loading" });
  const validatedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    const urlToken = searchParams.get("token");
    const storedToken = getFounderInvitationToken();
    const token = urlToken ?? storedToken;

    if (!token || !TOKEN_PATTERN.test(token)) {
      clearFounderInvitationToken();
      setState({ kind: "invalid" });
      return;
    }

    const run = async () => {
      try {
        const result: FounderInvitationValidationResult = await validateFounderInvitation(token);
        if (!result.valid) {
          clearFounderInvitationToken();
          setState({ kind: "invalid" });
          return;
        }

        setFounderInvitationToken(token);
        if (urlToken) {
          window.history.replaceState(null, "", "/founders/accept");
        }

        setState({
          kind: "valid-signed-out",
          organizationName: result.organizationName,
          invitedEmail: result.invitedEmail,
          expiresAt: result.expiresAt,
        });
      } catch {
        setState({ kind: "error" });
      }
    };

    void run();
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (
      state.kind !== "valid-signed-out" &&
      state.kind !== "valid-matching" &&
      state.kind !== "valid-wrong-user"
    ) {
      return;
    }

    if (!user) {
      if (state.kind !== "valid-signed-out") {
        setState({
          kind: "valid-signed-out",
          organizationName: state.organizationName,
          invitedEmail: state.invitedEmail,
          expiresAt: state.expiresAt,
        });
      }
      return;
    }

    const authEmail = (user.email ?? "").toLowerCase();
    const invitedEmail = state.invitedEmail.toLowerCase();
    const targetKind = authEmail === invitedEmail ? "valid-matching" : "valid-wrong-user";

    if (state.kind !== targetKind) {
      setState({
        kind: targetKind,
        organizationName: state.organizationName,
        invitedEmail: state.invitedEmail,
        expiresAt: state.expiresAt,
        ...(targetKind === "valid-wrong-user" ? { authEmail } : {}),
      } as AcceptanceState);
    }
  }, [authLoading, user, state]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.kind]);

  const handleAccept = useCallback(async () => {
    const token = getFounderInvitationToken();
    if (!token || state.kind !== "valid-matching") return;

    setState({ kind: "accepting", organizationName: state.organizationName });
    try {
      const result = await acceptFounderInvitation(token);
      clearFounderInvitationToken();
      // Best-effort, inline: the common-path happy flow completes
      // provisioning before the user ever sees /founders/welcome, so
      // there's no visible "setting up" flash. If this fails (network
      // blip, etc.) the acceptance itself already committed and stands —
      // /founders/welcome's own resolver detects accepted_not_provisioned
      // and retries provisioning itself, so nothing here is a hard
      // dependency (spec §19: a downstream failure must never undo an
      // already-committed step).
      try {
        await provisionFounderOrganization();
      } catch {
        /* recoverable on /founders/welcome */
      }
      setState({ kind: "accepted", organizationName: result.organizationName });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("different email address")) {
        setState({ kind: "invalid" });
        clearFounderInvitationToken();
      } else if (message.includes("invitation is invalid, expired, or no longer available")) {
        clearFounderInvitationToken();
        setState({ kind: "invalid" });
      } else {
        setState({ kind: "error" });
      }
    }
  }, [state]);

  const goSignIn = useCallback(
    (mode: "signin" | "signup") => {
      if (state.kind !== "valid-signed-out") return;
      setAuthReturnDestination("/founders/accept");
      navigate("/signin", {
        state: {
          from: "/founders/accept",
          mode,
          email: state.invitedEmail,
          lockedEmail: mode === "signup",
        },
      });
    },
    [navigate, state]
  );

  const handleSwitchAccount = useCallback(async () => {
    await signOut("local");
  }, [signOut]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return (
    <main className="founders-accept-page">
      <header className="founders-accept-header">
        <Link className="founders-accept-logo" to="/" aria-label="Salsa Segura home">
          <SalsaSeguraLogo variant="full" size="lg" tone="brand" />
        </Link>
      </header>

      <div className="founders-accept-content">
        {state.kind === "loading" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              Checking invitation…
            </h1>
            <p className="founders-accept-muted">Please wait while we verify your invitation.</p>
          </section>
        )}

        {state.kind === "valid-signed-out" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              You have been invited to manage events on SalsaSegura
            </h1>
            <p className="founders-accept-org">{state.organizationName}</p>
            <p className="founders-accept-detail">
              This invitation was sent to <strong>{state.invitedEmail}</strong> and expires{" "}
              {formatDate(state.expiresAt)}.
            </p>
            <div className="founders-accept-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => goSignIn("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => goSignIn("signup")}
              >
                Create Account
              </button>
            </div>
            <p className="founders-accept-hint">
              Use the email address the invitation was sent to. Do not have access to it? Contact
              the SalsaSegura team.
            </p>
          </section>
        )}

        {state.kind === "valid-matching" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              Accept your Founder invitation
            </h1>
            <p className="founders-accept-org">{state.organizationName}</p>
            <p className="founders-accept-detail">
              You are signed in as <strong>{state.invitedEmail}</strong>. Accept this invitation to
              continue setting up your organization.
            </p>
            <div className="founders-accept-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleAccept}
                disabled={false}
              >
                Accept Invitation
              </button>
            </div>
          </section>
        )}

        {state.kind === "valid-wrong-user" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              This invitation was sent to another email address
            </h1>
            <p className="founders-accept-detail">
              You are signed in as <strong>{state.authEmail}</strong>, but this invitation was sent
              to <strong>{state.invitedEmail}</strong>. Sign in with the invited email address to
              accept it.
            </p>
            <div className="founders-accept-actions">
              <button type="button" className="btn-primary" onClick={handleSwitchAccount}>
                Sign in with a different account
              </button>
            </div>
          </section>
        )}

        {state.kind === "invalid" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              This invitation is invalid, expired, or no longer available
            </h1>
            <p className="founders-accept-detail">
              The link may have already been used, expired, or been revoked. If you believe this is
              a mistake, contact the SalsaSegura team.
            </p>
            <Link to="/" className="btn-secondary founders-accept-home">
              Back to SalsaSegura
            </Link>
          </section>
        )}

        {state.kind === "accepting" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              Accepting invitation…
            </h1>
            <p className="founders-accept-muted">Please wait while we complete your acceptance.</p>
          </section>
        )}

        {state.kind === "accepted" && (
          <section className="founders-accept-card founders-accept-card--success" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              Invitation accepted
            </h1>
            <p className="founders-accept-org">{state.organizationName}</p>
            <p className="founders-accept-detail">
              Your SalsaSegura account is now connected to this Founder invitation. Let&apos;s
              finish setting up your organization.
            </p>
            <Link to="/founders/welcome" className="btn-primary founders-accept-home">
              Continue
            </Link>
          </section>
        )}

        {state.kind === "error" && (
          <section className="founders-accept-card" aria-labelledby="accept-heading">
            <h1 id="accept-heading" ref={headingRef} tabIndex={-1}>
              We could not complete the invitation right now
            </h1>
            <p className="founders-accept-detail">Please try again in a moment.</p>
            <div className="founders-accept-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          </section>
        )}
      </div>

      <footer className="founders-accept-footer">
        <Link to="/" className="founders-accept-footer-link">
          ← Back to SalsaSegura
        </Link>
      </footer>
    </main>
  );
}