import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";

/**
 * Redirects authenticated users who have not yet completed onboarding
 * to /onboarding. Anonymous users pass through (handled by RequireAuth
 * on the protected downstream route). Users with onboarding complete
 * pass through normally.
 */
export default function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useOwnProfile(user?.id);
  const location = useLocation();

  // Wait for auth resolution — never redirect during session restore.
  if (authLoading) return null;

  // Anonymous — not our concern; RequireAuth will handle them.
  if (!user) return <>{children}</>;

  // Profile still loading — hold, don't flash onboarding form.
  if (profileLoading) return null;

  const done = profile?.onboarding_completed_at != null;
  if (done) return <>{children}</>;

  // Preserve the destination so onboarding can redirect back.
  return (
    <Navigate to="/onboarding" state={{ returnTo: location.pathname + location.search }} replace />
  );
}
