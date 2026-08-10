import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * OAuth callback page. After Supabase redirects back from the provider,
 * this exchanges the code for a session and redirects to the home page.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.hash,
      );
      // Note: Supabase stores the auth code in the URL hash/fragment
      // after redirect from the provider.

      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Successfully authenticated — go home
        navigate("/", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <section className="auth-section">
        <div className="auth-card">
          <h1>Authentication Error</h1>
          <p style={{ color: "#991b2b" }}>{error}</p>
          <button onClick={() => navigate("/signin")}>Try Again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Signing in…</h1>
        <p>Please wait while we complete the sign-in process.</p>
      </div>
    </section>
  );
}
