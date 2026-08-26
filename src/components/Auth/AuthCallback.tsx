import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "./AuthCallback.css";

/**
 * Public callback route for authentication returns (email confirmation today,
 * password reset and OAuth providers later). Exchanges the PKCE ?code= param
 * for a session when present; otherwise relies on detectSessionInUrl having
 * absorbed an implicit-hash token and verifies a session exists.
 *
 * Session persistence stays owned by Supabase + AuthContext — this component
 * only completes the exchange and navigates.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error_description") ?? params.get("error");

        if (errorParam) {
          // e.g. expired or already-used confirmation link
          console.warn("Auth callback returned an error:", errorParam);
          if (!cancelled) setError("expired");
          return;
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("Code exchange failed:", exchangeError.message);
            if (!cancelled) setError("expired");
            return;
          }
        }

        // Confirm a session actually exists (covers both flows above).
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;
        if (!session) {
          setError("no-session");
          return;
        }

        // Successful confirmation lands on home. Future phases can expand this.
        navigate("/", { replace: true });
      } catch (err) {
        console.warn("Auth callback failed:", err);
        if (!cancelled) setError("unknown");
      }
    };

    void complete();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <section className="auth-card">
        <h1>We couldn&apos;t complete your sign-in</h1>
        <p className="auth-message" role="alert">
          The link may have expired or already been used.
          <br />
          Please try signing in again.
        </p>
        <Link to="/signin" className="btn-primary btn-block">
          Back to sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h1>Confirming your account…</h1>
    </section>
  );
}
