import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { roleFromUser } from "../../contexts/authContextObject";
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
  const [busy, setBusy] = useState(false);
  const consumedRef = useRef(false);

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

    if (password.length < 8) {
      setSetupError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSetupError("Passwords do not match.");
      return;
    }

    setSetupError(null);
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setSetupError(updateError.message);
        return;
      }
      navigate("/host", { replace: true });
    } catch (err) {
      console.warn("Invite password update failed:", err);
      setSetupError("Failed to set your password. Please try again.");
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
          <p className="auth-error" role="alert">
            {setupError}
          </p>
        )}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="invite-password">Password</label>
            <input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label htmlFor="invite-confirm-password">Confirm password</label>
            <input
              id="invite-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
            />
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
