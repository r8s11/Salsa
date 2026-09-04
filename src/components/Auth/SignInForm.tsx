import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { roleFromUser } from "../../contexts/authContextObject";
import { resolveAuthorizedDestination, isSafeInternalPath } from "../../lib/authDestination";
import { consumeAuthReturnDestination } from "../../lib/authReturnDestination";
import FormFieldError from "../../shared/forms/FormFieldError";
import { fieldErrorProps } from "../../shared/forms/fieldErrorProps";
import "./SignInForm.css";

type Mode = "signin" | "signup" | "reset";

import { friendlyAuthError, isUnconfirmedEmail } from "./authUtils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInForm() {
  const { signInWithPassword, resendConfirmation, requestPasswordReset, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(location.state?.mode === "reset" ? "reset" : "signin");
  const [email, setEmail] = useState(typeof location.state?.email === "string" ? location.state.email : "");
  const emailLocked = location.state?.lockedEmail === true;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const resetEmailRef = useRef<HTMLInputElement>(null);

  /**
   * Inputs are `disabled={loading}` while an auth call is in flight, and
   * focusing a disabled control is a no-op — so a server-failure focus request
   * is queued here and applied once the field is interactive again.
   */
  const pendingFocusRef = useRef<HTMLInputElement | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const requestFocus = (target: HTMLInputElement | null) => {
    pendingFocusRef.current = target;
    setFocusRequest((attempt) => attempt + 1);
  };

  useEffect(() => {
    if (focusRequest === 0 || loading) return;
    pendingFocusRef.current?.focus();
    pendingFocusRef.current = null;
  }, [focusRequest, loading]);

  const clearFieldErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setResetEmailError(null);
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setErrorMsg(null);
    setMessage(null);
    setShowResend(false);
    clearFieldErrors();
    // Don't clear a locked email (Founder invitation signup): the email
    // is tied to the invitation and must survive a mode toggle.
    if (!emailLocked) setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const openResetMode = () => {
    setMode("reset");
    setErrorMsg(null);
    setMessage(null);
    setShowResend(false);
    clearFieldErrors();
  };

  const backToSignIn = () => {
    setMode("signin");
    setErrorMsg(null);
    setMessage(null);
    clearFieldErrors();
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
    clearFieldErrors();

    const trimmedEmail = email.trim();
    let firstInvalid: HTMLInputElement | null = null;
    let hasFieldError = false;

    if (!trimmedEmail) {
      setEmailError("Enter your email address.");
      firstInvalid = emailRef.current;
      hasFieldError = true;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      firstInvalid = emailRef.current;
      hasFieldError = true;
    }

    if (!password) {
      setPasswordError("Enter your password.");
      firstInvalid ??= passwordRef.current;
      hasFieldError = true;
    } else if (mode === "signup" && password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      firstInvalid ??= passwordRef.current;
      hasFieldError = true;
    }

    if (mode === "signup") {
      if (!confirmPassword) {
        setConfirmPasswordError("Confirm your password.");
        firstInvalid ??= confirmPasswordRef.current;
        hasFieldError = true;
      } else if (confirmPassword !== password) {
        setConfirmPasswordError("Passwords do not match.");
        firstInvalid ??= confirmPasswordRef.current;
        hasFieldError = true;
      }
    }

    if (hasFieldError) {
      firstInvalid?.focus();
      return;
    }

    if (mode === "signin") {
      const { error, user } = await signInWithPassword(email, password);
      if (error) {
        setErrorMsg(friendlyAuthError(error.message));
        // Unconfirmed accounts get a recovery path instead of a dead end.
        setShowResend(isUnconfirmedEmail(error.message));
        requestFocus(emailRef.current);
      } else {
        redirectAfterAuth(user);
      }
    } else {
      const { error, session, user } = await signUp(email, password);
      if (error) {
        setErrorMsg(friendlyAuthError(error.message));
        requestFocus(emailRef.current);
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
    clearFieldErrors();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setResetEmailError("Enter your email address.");
      resetEmailRef.current?.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setResetEmailError("Enter a valid email address.");
      resetEmailRef.current?.focus();
      return;
    }

    const { error } = await requestPasswordReset(email);
    if (error) {
      // Rate limiting and malformed-email failures are the only cases
      // Supabase actually surfaces here; existence is never revealed.
      setErrorMsg(friendlyAuthError(error.message));
      requestFocus(resetEmailRef.current);
    } else {
      setMessage("If an account exists for that email, we've sent a link to reset your password.");
    }
  };

  // A genuinely form-level auth failure ("Incorrect email or password.") stays
  // form-level, but the credential fields point at it so a screen reader hears
  // the reason while inspecting the field it belongs to.
  const credentialHintIds =
    [emailLocked ? "email-locked-hint" : null, errorMsg ? "auth-form-error" : null]
      .filter(Boolean)
      .join(" ") || undefined;

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
        <div className="auth-error" id="auth-form-error" role="alert">
          {errorMsg}
        </div>
      )}
      {message && (
        <div className="auth-message" id="auth-form-status" role="status">
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
        <form onSubmit={handleResetSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              disabled={loading}
              ref={resetEmailRef}
              {...fieldErrorProps("reset-email-error", resetEmailError)}
            />
            <FormFieldError id="reset-email-error" message={resetEmailError} />
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? "Please wait…" : "Send reset link"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              disabled={loading}
              readOnly={emailLocked}
              ref={emailRef}
              {...fieldErrorProps("email-error", emailError, credentialHintIds)}
            />
            {emailLocked && (
              <p id="email-locked-hint" className="field-hint">
                This email is fixed by your invitation and can't be changed.
              </p>
            )}
            <FormFieldError id="email-error" message={emailError} />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={loading}
                minLength={6}
                ref={passwordRef}
                {...fieldErrorProps("password-error", passwordError, errorMsg ? "auth-form-error" : undefined)}
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
            <FormFieldError id="password-error" message={passwordError} />
            {mode === "signin" && (
              <div className="forgot-password-row">
                <button type="button" className="link-button" onClick={openResetMode} disabled={loading}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {mode === "signup" && (
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
                ref={confirmPasswordRef}
                {...fieldErrorProps("confirm-password-error", confirmPasswordError)}
              />
              <FormFieldError id="confirm-password-error" message={confirmPasswordError} />
            </div>
          )}

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
