import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { roleFromUser } from "../../contexts/authContextObject";
import { publicErrorMessage } from "../../shared/forms/errorMessage";
import FormFieldError from "../../shared/forms/FormFieldError";
import { fieldErrorProps } from "../../shared/forms/fieldErrorProps";
import "./InviteActivationPage.css";

type ActivationError = "invalid" | "not-organizer" | "unknown";

const ERROR_MESSAGES: Record<ActivationError, string> = {
  invalid:
    "This invitation link is invalid, expired, or has already been used. Please request a new invitation.",
  "not-organizer":
    "This organizer invitation could not be verified for your account. Sign in or contact an admin for help.",
  unknown: "Something went wrong while activating your invitation. Please try again.",
};

/**
 * Dedicated organizer invitation activation route. Consumes a one-time
 * Supabase invite callback (PKCE code, hash access/refresh tokens, or a
 * token-hash + type=invite link), confirms the resulting session belongs to
 * a trusted `organizer` (via `app_metadata.role`), gates password setup
 * behind that check, and navigates to /host only after the password is set.
 *
 * This route is separate from /auth/callback (email confirmation) and never
 * writes role/user metadata itself.
 */
export default function InviteActivationPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<ActivationError | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [confirmPasswordFieldError, setConfirmPasswordFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const consumedRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const complete = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const errorParam =
          params.get("error_description") ??
          params.get("error") ??
          hashParams.get("error_description") ??
          hashParams.get("error");
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type");

        if (errorParam) {
          console.warn("Invite callback returned an error:", errorParam);
          setError("invalid");
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("Invite code exchange failed:", exchangeError.message);
            setError("invalid");
            return;
          }
        } else if (tokenHash && type === "invite") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "invite",
          });
          if (verifyError) {
            console.warn("Invite token hash verification failed:", verifyError.message);
            setError("invalid");
            return;
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
              console.warn("Invite hash session failed:", setSessionError.message);
              setError("invalid");
              return;
            }
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError("invalid");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const role = roleFromUser(user);
        if (role !== "organizer") {
          setError("not-organizer");
          return;
        }

        setShowSetup(true);
      } catch (err) {
        console.warn("Invite activation failed:", err);
        setError("unknown");
      } finally {
        setProcessing(false);
      }
    };

    void complete();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setSetupError(
          publicErrorMessage(updateError, {
            fallback: "We couldn't set your password. Please try again.",
          })
        );
        return;
      }
      navigate("/host", { replace: true });
    } catch (err) {
      console.warn("Invite password update failed:", err);
      setSetupError(
        publicErrorMessage(err, { fallback: "We couldn't set your password. Please try again." })
      );
    } finally {
      setBusy(false);
    }
  };

  if (processing) {
    return (
      <section className="auth-card">
        <h1>Activating your invitation…</h1>
        <p className="auth-message" role="status">
          Please wait while we confirm your invitation.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="auth-card">
        <h1>We couldn&apos;t activate your invitation</h1>
        <p className="auth-error" role="alert">
          {ERROR_MESSAGES[error]}
        </p>
        <Link to="/signin" className="btn-primary btn-block">
          Back to sign in
        </Link>
      </section>
    );
  }

  if (showSetup) {
    return (
      <section className="auth-card">
        <h1>Set your organizer password</h1>
        {setupError && (
          <p className="auth-error" id="invite-setup-error" role="alert">
            {setupError}
          </p>
        )}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="invite-password">Password</label>
            <input
              id="invite-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              ref={passwordRef}
              {...fieldErrorProps("invite-password-error", passwordFieldError)}
            />
            <FormFieldError id="invite-password-error" message={passwordFieldError} />
          </div>
          <div className="form-group">
            <label htmlFor="invite-confirm-password">Confirm password</label>
            <input
              id="invite-confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              ref={confirmPasswordRef}
              {...fieldErrorProps("invite-confirm-password-error", confirmPasswordFieldError)}
            />
            <FormFieldError id="invite-confirm-password-error" message={confirmPasswordFieldError} />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={busy}>
            {busy ? "Setting password…" : "Set password & continue"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h1>Activating your invitation…</h1>
    </section>
  );
}
