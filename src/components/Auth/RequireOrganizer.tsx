import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useMyOrganizers } from "../../features/host/hooks/useMyOrganizers";

/**
 * Protects the Host area by requiring an authenticated session. The /host
 * landing renders the caller's real access state, while nested host resource
 * routes require an organizer role or active organizer membership. Database
 * RLS remains the source of truth for what each state can see or change.
 * Admins and moderators keep the platform surfaces behind RequireAdmin /
 * RequireReviewer.
 */
export default function RequireOrganizer({ children }: { children: ReactNode }) {
  const { user, loading, isOrganizer } = useAuth();
  const location = useLocation();
  const { data: organizers = [], isLoading: organizersLoading } = useMyOrganizers();

  if (loading || (user && organizersLoading)) {
    return (
      <div className="page-loading" role="status">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  const isHostLanding = location.pathname === "/host" || location.pathname === "/host/";
  if (!isHostLanding && !isOrganizer && organizers.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
