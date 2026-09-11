import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

/**
 * Protects a route by requiring an authenticated session AND the admin
 * app_metadata role. Non-admins (signed in or not) are bounced silently —
 * this route has no public entry point (no nav link).
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "40vh",
          fontSize: "1.1rem",
          color: "var(--muted, #666)",
        }}
      >
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
