import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { roleFromUser } from "../../contexts/authContextObject";
import { resolveAuthorizedDestination, isSafeInternalPath } from "../../lib/authDestination";
import { consumeAuthReturnDestination } from "../../lib/authReturnDestination";
import "./SignInForm.css";

type Mode = "signin" | "signup" | "reset";

import { friendlyAuthError } from "./authUtils";

export default function SignInForm() {
  const { signInWithPassword, resendConfirmation, requestPasswordReset, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(location.state?.mode === "reset" ? "reset" : "signin");
  const [email, setEmail] = useState(typeof location.state?.email === "string" ? location.state.email : "");
  const emailLocked = location.state?.lockedEmail === true;
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setErrorMsg(null);
    setMessage(null);
    setShowResend(false);
    // Don't clear a locked email (Founder invitation signup): the email
    // is tied to the invitation and must survive a mode toggle.
    if (!emailLocked) setEmail("");
    setPassword("");
  };

  const openResetMode = () => {
    setMode("reset");
    setErrorMsg(null);
    setMessage(null);
    setShowResend(false);
  };

  const backToSignIn = () => {
    setMode("signin");
    setErrorMsg(null);
    setMessage(null);
  };

  const handleResend = async () => {
    setErrorMsg(null);
    setMessage(null);
    const { error } = await resendConfirmation(email);
    if (error) {
      setErrorMsg("We couldn't send the email. Please try again shortly.");
    } else {
      setShowResend(false);
      setMessage("Confirmation email sent. Please check your inbox.");
    }
  };
  const redirectAfterAuth = (user: User | null) => {
    const role = roleFromUser(user);
    // A return destination set by a flow that sent the user here (e.g.
    // Founder invitation acceptance) takes precedence over both the
    // location.state.from hint and the role default. Consume it exactly
    // once so it never survives past this auth completion into a later,
    // unrelated email-link flow.
    const returnDestination = consumeAuthReturnDestination();
    const from = location.state?.from;
    const destination = returnDestination ?? (isSafeInternalPath(from) ? from : resolveAuthorizedDestination(role));
    navigate(destination, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (mode === "signin") {
      const { error, user } = await signInWithPassword(email, password);
      if (error) {
        setErrorMsg(friendlyAuthError(error.message));
        // Unconfirmed accounts get a recovery path instead of a dead end.
        setShowResend(/email not confirmed/i.test(error.message));
      } else {
        redirectAfterAuth(user);
      }
    } else {
      const { error, session, user } = await signUp(email, password);
      if (error) {
        setErrorMsg(friendlyAuthError(error.message));
      } else if (session) {
        // Email confirmation is disabled (e.g. local dev): Supabase already
        // signed the user in, so send them where sign-in would rather than
        // telling them to check an email that was never sent.
        redirectAfterAuth(user);
      } else {
        setMessage(
          "Check your email — we sent a confirmation link to finish creating your account."
        );
      }
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    const { error } = await requestPasswordReset(email);
    if (error) {
      // Rate limiting and malformed-email failures are the only cases
      // Supabase actually surfaces here; existence is never revealed.
      setErrorMsg(friendlyAuthError(error.message));
    } else {
      setMessage("If an account exists for that email, we've sent a link to reset your password.");
    }
  };

  return (
    <section className="auth-card">
      <h1>
        {mode === "reset"
          ? "Reset your password"
          : mode === "signin"
            ? "Welcome back"
            : "Create your account"}
      </h1>

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}
      {message && (
        <div className="auth-message" role="status">
          {message}
        </div>
      )}
      {showResend && (
        <button
          type="button"
          className="link-button"
          onClick={handleResend}
          disabled={loading}
        >
          Resend confirmation email
        </button>
      )}

      {mode === "reset" ? (
        <form onSubmit={handleResetSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? "Please wait…" : "Send reset link"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              readOnly={emailLocked}
              aria-describedby={emailLocked ? "email-locked-hint" : undefined}
            />
            {emailLocked && (
              <p id="email-locked-hint" className="field-hint">
                This email is fixed by your invitation and can't be changed.
              </p>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={loading}
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {mode === "signin" && (
              <div className="forgot-password-row">
                <button type="button" className="link-button" onClick={openResetMode} disabled={loading}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>
      )}

      <p className="auth-toggle">
        {mode === "reset" ? (
          <button type="button" className="link-button" onClick={backToSignIn}>
            Back to sign in
          </button>
        ) : (
          <>
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            <button type="button" className="link-button" onClick={toggleMode}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </>
        )}
      </p>
    </section>
  );
}
