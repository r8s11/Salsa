import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

/**
 * Protects the Host area by requiring an authenticated session AND the
 * organizer app_metadata role. Host is the product name for that role;
 * admins and moderators keep the platform surfaces behind RequireReviewer.
 */
export default function RequireOrganizer({ children }: { children: ReactNode }) {
  const { user, loading, isOrganizer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loading" role="status">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  if (!isOrganizer) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
