import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useHostCapabilities } from "../../features/host/hooks/useHostCapabilities";

/**
 * Protects the Host area by requiring an authenticated session. The /host
 * landing renders the caller's real access state, while nested host resource
 * routes require effective Host access — an organizer role or an active
 * organizer membership, as decided by useHostCapabilities. The Host shell
 * reads the same capabilities, so navigation can never contradict this
 * guard. Database RLS remains the source of truth for what each state can
 * see or change. Admins and moderators keep the platform surfaces behind
 * RequireAdmin / RequireReviewer.
 */
export default function RequireOrganizer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { hasHostAccess, isLoading: capabilitiesLoading } = useHostCapabilities();

  if (loading || capabilitiesLoading) {
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
  if (!isHostLanding && !hasHostAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
