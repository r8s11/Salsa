import { useMemo } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { useMyOrganizers } from "./useMyOrganizers";
import { deriveHostCapabilities, type HostCapabilities } from "../model/hostCapabilities";

export type UseHostCapabilitiesResult = HostCapabilities & {
  /** Memberships are still in flight — callers must not deny access yet. */
  isLoading: boolean;
};

/**
 * Canonical effective-Host-access hook. The route guard and the Host shell
 * both read this, so navigation visibility and route authorization cannot
 * drift apart (the P2-8 defect: an active membership admitted the workspace
 * while role-only navigation rendered nothing).
 *
 * Anonymous visitors resolve to no access without a special case: the role
 * claim comes from the session and useMyOrganizers stays disabled.
 */
export function useHostCapabilities(): UseHostCapabilitiesResult {
  const { user, isOrganizer } = useAuth();
  const { data: memberships, isLoading } = useMyOrganizers();
  const membershipsLoading = user != null && isLoading;

  return useMemo(
    () => ({
      ...deriveHostCapabilities({
        isOrganizerRole: isOrganizer === true,
        memberships: memberships ?? [],
      }),
      isLoading: membershipsLoading,
    }),
    [isOrganizer, memberships, membershipsLoading]
  );
}
