import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFounderInvitationForRequest,
  createFounderInvitation,
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

  const query = useQuery({
    queryKey,
    enabled: !!founderRequestId,
    queryFn: () => fetchFounderInvitationForRequest(founderRequestId!),
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
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
    mutationFn: () => sendFounderInvitation(founderRequestId!),
    onSuccess: () => invalidate(),
    onError: () => invalidate(), // a failed send still creates+revokes an invitation server-side
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
  };
}
