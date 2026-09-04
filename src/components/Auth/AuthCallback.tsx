import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/useAuth";
import { roleFromUser } from "../../contexts/authContextObject";
import { resolveCallbackDestination } from "../../lib/authDestination";
import { consumeAuthIntent, type AuthIntentKind } from "../../lib/authIntent";
import { consumeAuthReturnDestination } from "../../lib/authReturnDestination";
import { publicErrorMessage } from "../../shared/forms/errorMessage";
import FormFieldError from "../../shared/forms/FormFieldError";
import { fieldErrorProps } from "../../shared/forms/fieldErrorProps";
import "./AuthCallback.css";

type CallbackError = AuthIntentKind | "invalid";

const ERROR_COPY: Record<CallbackError, { heading: string; message: string }> = {
  signup: {
    heading: "We couldn't confirm your email",
    message:
      "This confirmation link is invalid, expired, or was already used. If you already confirmed your email, try signing in below — otherwise request a new confirmation email.",
  },
  recovery: {
    heading: "We couldn't reset your password",
    message: "This password reset link has expired or was already used. Request a new reset email to continue.",
  },
  invalid: {
    heading: "We couldn't complete your sign-in",
    message: "This authentication link is invalid or incomplete. Please try again or sign in.",
  },
};

/**
 * Public callback route for authentication returns: signup confirmation,
 * password recovery, and (once implemented) OAuth providers.
 *
 * Handles both link shapes a Supabase email can produce, entirely manually
 * (the client has `detectSessionInUrl: false` — see supabase.ts for why):
 *  - PKCE `?code=`: exchanged via `exchangeCodeForSession`, which returns
 *    `redirectType` directly in its result ("recovery" or null) — no event
 *    subscription needed, so there is nothing to race or miss.
 *  - Legacy implicit `#access_token=&refresh_token=&type=`: applied via
 *    `setSession`, with `type` read straight from the hash.
 *
 * Signup and recovery links both land here — GoTrue's PKCE redirect never
 * echoes back which flow produced the link *on failure* (only success
 * carries `redirectType`). A failed link falls back to the `authIntent`
 * hint (see that module) recorded by whichever action started the flow, for
 * flow-appropriate error copy.
 *
 * Session persistence stays owned by Supabase + AuthContext — this component
 * only completes the exchange, optionally captures a new password, and
 * navigates (honoring a safe `?next=` destination when present).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resendConfirmation } = useAuth();
  const [error, setError] = useState<CallbackError | null>(null);
  const [intentEmail, setIntentEmail] = useState<string | undefined>(undefined);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [confirmPasswordFieldError, setConfirmPasswordFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "sent" | "failed">("idle");
  const consumedRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Effects run twice in React StrictMode dev builds. exchangeCodeForSession
    // and setSession each consume single-use, non-replayable material — a
    // second real call always fails — so the work itself (not just its state
    // updates) must run at most once.
    if (consumedRef.current) return;
    consumedRef.current = true;

    const fail = (kind: CallbackError | null) => {
      const intent = consumeAuthIntent();
      setIntentEmail(intent?.email);
      setError(kind ?? intent?.kind ?? "invalid");
    };

    const complete = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.slice(1));
        const errorParam =
          params.get("error_description") ??
          params.get("error") ??
          hashParams.get("error_description") ??
          hashParams.get("error");
        const code = params.get("code");

        if (errorParam) {
          // e.g. expired or already-used confirmation/recovery link
          console.warn("Auth callback returned an error:", errorParam);
          fail(null);
          return;
        }

        let redirectType: string | null = null;

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("Code exchange failed:", exchangeError.message);
            fail(null);
            return;
          }
          // The public AuthTokenResponse type omits `redirectType`, but the
          // runtime response includes it (it's how GoTrue distinguishes a
          // signup/OAuth code from a recovery one) — narrow instead of
          // trusting an unchecked cast.
          if ("redirectType" in data && typeof data.redirectType === "string") {
            redirectType = data.redirectType;
          }
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionError) {
              console.warn("Session from hash failed:", setSessionError.message);
              fail(null);
              return;
            }
            redirectType = hashParams.get("type");
          }
        }

        // Confirm a session actually exists (covers both flows above).
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          fail(null);
          return;
        }

        // The flow that requested this link succeeded; clear its hint.
        consumeAuthIntent();

        if (redirectType === "recovery") {
          setShowRecoverySetup(true);
          return;
        }
        // Route to a role-appropriate (or explicitly requested) destination.
        // A return destination set by a flow that sent the user through an
        // emailed link (e.g. Founder invitation acceptance) takes precedence
        // over both the role default and the `?next=` param, because the
        // emailed link cannot carry a next param (see authReturnDestination.ts).
        const role = roleFromUser(session.user);
        const returnDestination = consumeAuthReturnDestination();
        if (returnDestination) {
          navigate(returnDestination, { replace: true });
        } else {
          navigate(resolveCallbackDestination(role, params.get("next")), { replace: true });
        }
      } catch (err) {
        console.warn("Auth callback failed:", err);
        fail("invalid");
      }
    };

    void complete();
  }, [navigate, location.search, location.hash]);

  const handleResendConfirmation = async () => {
    if (!intentEmail || resendStatus === "pending") return;
    setResendStatus("pending");
    const { error: resendError } = await resendConfirmation(intentEmail);
    setResendStatus(resendError ? "failed" : "sent");
  };

  const handleRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setSetupError(null);
    setPasswordFieldError(null);
    setConfirmPasswordFieldError(null);

    if (password.length < 8) {
      setPasswordFieldError("Password must be at least 8 characters.");
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordFieldError("Passwords do not match.");
      confirmPasswordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setSetupError(
          publicErrorMessage(updateError, {
            fallback: "We couldn't update your password. Please try again.",
          })
        );
        return;
      }
      const role = roleFromUser(data.user);
      const returnDestination = consumeAuthReturnDestination();
      if (returnDestination) {
        navigate(returnDestination, { replace: true });
      } else {
        const next = new URLSearchParams(location.search).get("next");
        navigate(resolveCallbackDestination(role, next), { replace: true });
      }
    } catch (err) {
      console.warn("Password update failed:", err);
      setSetupError(
        publicErrorMessage(err, { fallback: "We couldn't update your password. Please try again." })
      );
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    const copy = ERROR_COPY[error];
    return (
      <section className="auth-card">
        <h1>{copy.heading}</h1>
        <p className="auth-error" role="alert">
          {copy.message}
        </p>
        {error === "signup" && intentEmail && (
          <button
            type="button"
            className="link-button"
            onClick={handleResendConfirmation}
            disabled={resendStatus === "pending"}
          >
            {resendStatus === "pending" ? "Sending…" : "Resend confirmation email"}
          </button>
        )}
        {error === "signup" && resendStatus === "sent" && (
          <p className="auth-message" role="status">
            Confirmation email sent. Please check your inbox.
          </p>
        )}
        {error === "signup" && resendStatus === "failed" && (
          <p className="auth-error" role="alert">
            We couldn't send the email. Please try again shortly.
          </p>
        )}
        {error === "recovery" && (
          <Link to="/signin" state={{ mode: "reset", email: intentEmail }} className="link-button">
            Request a new reset email
          </Link>
        )}
        <Link to="/signin" className="btn-primary btn-block">
          Back to sign in
        </Link>
      </section>
    );
  }

  if (showRecoverySetup) {
    return (
      <section className="auth-card">
        <h1>Set a new password</h1>
        {setupError && (
          <p className="auth-error" id="recovery-setup-error" role="alert">
            {setupError}
          </p>
        )}
        <form onSubmit={handleRecoverySubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="recovery-password">New password</label>
            <input
              id="recovery-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              ref={passwordRef}
              {...fieldErrorProps("recovery-password-error", passwordFieldError)}
            />
            <FormFieldError id="recovery-password-error" message={passwordFieldError} />
          </div>
          <div className="form-group">
            <label htmlFor="recovery-confirm-password">Confirm new password</label>
            <input
              id="recovery-confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              ref={confirmPasswordRef}
              {...fieldErrorProps("recovery-confirm-password-error", confirmPasswordFieldError)}
            />
            <FormFieldError id="recovery-confirm-password-error" message={confirmPasswordFieldError} />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={busy}>
            {busy ? "Updating password…" : "Set new password"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h1>Confirming your account…</h1>
    </section>
  );
}
