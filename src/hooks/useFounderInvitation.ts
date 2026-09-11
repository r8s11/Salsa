import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFounderInvitationDeliveryAttempts,
  fetchFounderInvitationForRequest,
  fetchFounderInvitationHistory,
  createFounderInvitation,
  reissueFounderInvitation,
  revokeFounderInvitation,
  sendFounderInvitation,
} from "../features/admin/api/founderInvitationRepo";

/**
 * Admin-level invitation state + mutations for a single founder request's
 * detail page. Mirrors the shape of `useFounderRequest`/`useFounderRequests`
 * from Phase 3, scoped to one request's invitation lifecycle.
 */
export function useFounderInvitation(founderRequestId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "founder-invitation", founderRequestId];
  const historyQueryKey = ["admin", "founder-invitation-history", founderRequestId];

  const query = useQuery({
    queryKey,
    enabled: !!founderRequestId,
    queryFn: () => fetchFounderInvitationForRequest(founderRequestId!),
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: historyQueryKey });
  };

  const createMutation = useMutation({
    mutationFn: () => createFounderInvitation(founderRequestId!),
    onSuccess: () => invalidate(),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeFounderInvitation(invitationId),
    onSuccess: () => invalidate(),
  });

  const sendMutation = useMutation({
    mutationFn: (idempotencyKey: string) => sendFounderInvitation(founderRequestId!, idempotencyKey),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
  });

  const reissueMutation = useMutation({
    mutationFn: (idempotencyKey: string) => reissueFounderInvitation(founderRequestId!, idempotencyKey),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
  });

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    enabled: !!founderRequestId,
    queryFn: async () => {
      const invitations = await fetchFounderInvitationHistory(founderRequestId!);
      const attempts = await Promise.all(
        invitations.map((invitation) => fetchFounderInvitationDeliveryAttempts(invitation.id))
      );
      const attemptsByInvitation = Object.fromEntries(
        invitations.map((row, index) => [row.id, attempts[index] ?? []])
      );
      return { invitations, attemptsByInvitation };
    },
    staleTime: 0,
  });

  return {
    invitation: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    createInvitation: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    createdInvitation: createMutation.data ?? null,
    resetCreatedInvitation: createMutation.reset,
    revokeInvitation: revokeMutation.mutate,
    isRevoking: revokeMutation.isPending,
    revokeError: revokeMutation.error,
    sendInvitation: sendMutation.mutate,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
    sentInvitation: sendMutation.data ?? null,
    resetSendResult: sendMutation.reset,
    reissueInvitation: reissueMutation.mutate,
    isReissuing: reissueMutation.isPending,
    reissueError: reissueMutation.error,
    reissuedInvitation: reissueMutation.data ?? null,
    resetReissueResult: reissueMutation.reset,
    invitationHistory: historyQuery.data?.invitations ?? [],
    deliveryAttemptsByInvitation: historyQuery.data?.attemptsByInvitation ?? {},
    isHistoryLoading: historyQuery.isLoading,
    historyError: historyQuery.error,
  };
}
