import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import "./SignInForm.css";

type Mode = "signin" | "signup";

export default function SignInForm() {
  const { signInWithPassword, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setErrorMsg(null);
    setMessage(null);
    setEmail("");
    setPassword("");
  };

  const redirectAfterAuth = () => {
    const destination =
      typeof location.state?.from === "string" ? location.state.from : "/";
    navigate(destination, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        redirectAfterAuth();
      }
    } else {
      const { error, session } = await signUp(email, password);
      if (error) {
        setErrorMsg(error.message);
      } else if (session) {
        // Email confirmation is disabled (e.g. local dev): Supabase already
        // signed the user in, so send them where sign-in would rather than
        // telling them to check an email that was never sent.
        redirectAfterAuth();
      } else {
        setMessage("Check your email for a confirmation link.");
      }
    }
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>{mode === "signin" ? "Sign In" : "Sign Up"}</h1>

        {errorMsg && <div className="auth-error" role="alert">{errorMsg}</div>}
        {message && <div className="auth-message" role="status">{message}</div>}

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
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              disabled={loading}
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="oauth-buttons">
          <button type="button" className="btn-oauth btn-apple" disabled>
            Continue with Apple (Coming soon)
          </button>
          <button type="button" className="btn-oauth btn-google" disabled>
            Continue with Google (Coming soon)
          </button>
          <button type="button" className="btn-oauth btn-github" disabled>
            Continue with GitHub (Coming soon)
          </button>
        </div>

        <p className="auth-toggle">
          {mode === "signin"
            ? "Don't have an account?"
            : "Already have an account?"}
          <button
            type="button"
            className="link-button"
            onClick={toggleMode}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </section>
  );
}
