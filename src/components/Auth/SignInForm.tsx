import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../contexts/useAuth";
import "./SignInForm.css";

type Mode = "signin" | "signup";

export default function SignInForm() {
  const { signInWithPassword, signUp, signInWithOAuth, loading } = useAuth();
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await signInWithPassword(email, password);
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setErrorMsg(error.message);
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
          <button
            type="button"
            className="btn-oauth btn-apple"
            onClick={() => signInWithOAuth("apple")}
            disabled={loading}
          >
            Continue with Apple
          </button>
          <button
            type="button"
            className="btn-oauth btn-google"
            onClick={() => signInWithOAuth("google")}
            disabled={loading}
          >
            Continue with Google
          </button>
          <button
            type="button"
            className="btn-oauth btn-github"
            onClick={() => signInWithOAuth("github")}
            disabled={loading}
          >
            Continue with GitHub
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
