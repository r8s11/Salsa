import { useMutation, useQuery, useQueryClient, type QueryObserverResult } from "@tanstack/react-query";
import { useAuth } from "../contexts/useAuth";
import {
  fetchFounderOnboardingState,
  provisionFounderOrganization,
  requestFounderWelcomeEmail,
  type FounderOnboardingState,
  type ProvisionedFounderOrganization,
} from "../features/founder/api/founderOnboarding";

export interface UseFounderOnboardingResult {
  state: FounderOnboardingState | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<QueryObserverResult<FounderOnboardingState>>;
  provision: () => Promise<ProvisionedFounderOrganization>;
  requestWelcomeEmail: () => Promise<void>;
}

/**
 * Phase 8 read-model + provisioning hook for `/founders/welcome`. Mirrors
 * the shape of `useFounderInvitation`/`useMyOrganizers` — the query key is
 * scoped to the signed-in user, and mutating (provisioning) invalidates it
 * rather than hand-updating cached state, so a re-render always reflects a
 * fresh read of `founder_onboarding_state()`.
 */
export function useFounderOnboarding(): UseFounderOnboardingResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["founder-onboarding-state", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: fetchFounderOnboardingState,
    enabled: user !== null,
    staleTime: 10_000,
  });

  const provisionMutation = useMutation({
    mutationFn: provisionFounderOrganization,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    state: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    provision: provisionMutation.mutateAsync,
    // Fire-and-forget by design (see requestFounderWelcomeEmail) — not a
    // TanStack mutation, since there is no loading/error UI tied to it.
    requestWelcomeEmail: requestFounderWelcomeEmail,
  };
}
