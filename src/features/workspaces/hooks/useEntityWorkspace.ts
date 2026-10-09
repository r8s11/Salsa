import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addEntityMember,
  deleteSchoolOffering,
  fetchEntityWorkspace,
  removeEntityMember,
  saveEntityProfile,
  saveSchoolOffering,
  updateEntityMember,
} from "../api/workspacesRepo";
import type {
  EntityMemberRole,
  ManagedKind,
  OfferingType,
  PricePlanInput,
  PrivateOfferInput,
  ProfilePatch,
  SchoolClassInput,
  WorkspaceMember,
} from "../model";
import { MY_ENTITY_MEMBERSHIPS_KEY } from "./useMyEntityMemberships";

export const ENTITY_WORKSPACE_KEY = "entity-workspace";

/** One listing's workspace: profile, team, upcoming nights and (schools) offerings. */
export function useEntityWorkspace(kind: ManagedKind, id: string) {
  return useQuery({
    queryKey: [ENTITY_WORKSPACE_KEY, kind, id],
    queryFn: () => fetchEntityWorkspace(kind, id),
    // A refusal is an answer, not a glitch, and a failed read has its own Retry
    // control: waiting out backoff only delays the message.
    retry: false,
  });
}

/** The server's own words for a failed save, never a generic stand-in. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function useWorkspaceInvalidation(kind: ManagedKind, id: string) {
  const queryClient = useQueryClient();
  return (options: { memberships?: boolean } = {}) => {
    const refreshes = [queryClient.invalidateQueries({ queryKey: [ENTITY_WORKSPACE_KEY, kind, id] })];
    // Team changes can change what the caller themself may open.
    if (options.memberships) {
      refreshes.push(queryClient.invalidateQueries({ queryKey: [MY_ENTITY_MEMBERSHIPS_KEY] }));
    }
    return Promise.all(refreshes);
  };
}

export function useSaveProfile<K extends ManagedKind>(kind: K, id: string) {
  const refresh = useWorkspaceInvalidation(kind, id);
  return useMutation({
    mutationFn: (patch: ProfilePatch[K]) => saveEntityProfile(kind, id, patch),
    // Listing names feed the sidebar through the membership list.
    onSuccess: () => refresh({ memberships: true }),
  });
}

type OfferingInputs = { class: SchoolClassInput; private: PrivateOfferInput; plan: PricePlanInput };

/** What an offering editor needs from a save mutation, whatever the offering type. */
export type OfferingSaver<Input> = {
  isPending: boolean;
  mutateAsync: (args: { offeringId: string | null; input: Input }) => Promise<string>;
};

/** What a delete confirmation needs from a delete mutation. */
export type OfferingRemover = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  reset: () => void;
  mutateAsync: (offeringId: string) => Promise<void>;
};

/** Creates when `offeringId` is null, updates otherwise; refreshes the workspace either way. */
export function useSaveOffering<T extends OfferingType>(schoolId: string, type: T) {
  const refresh = useWorkspaceInvalidation("school", schoolId);
  return useMutation({
    mutationFn: ({ offeringId, input }: { offeringId: string | null; input: OfferingInputs[T] }) =>
      saveSchoolOffering(schoolId, type, offeringId, input),
    onSuccess: () => refresh(),
  });
}

export function useDeleteOffering(schoolId: string, type: OfferingType) {
  const refresh = useWorkspaceInvalidation("school", schoolId);
  return useMutation({
    mutationFn: (offeringId: string) => deleteSchoolOffering(schoolId, type, offeringId),
    onSuccess: () => refresh(),
  });
}

export function useAddMember(kind: ManagedKind, id: string) {
  const refresh = useWorkspaceInvalidation(kind, id);
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: EntityMemberRole }) =>
      addEntityMember(kind, id, email, role),
    onSuccess: () => refresh({ memberships: true }),
  });
}

export function useChangeMemberRole(kind: ManagedKind, id: string) {
  const refresh = useWorkspaceInvalidation(kind, id);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: EntityMemberRole }) =>
      updateEntityMember(kind, id, userId, role),
    onSuccess: () => refresh({ memberships: true }),
  });
}

export function useRemoveMember(kind: ManagedKind, id: string) {
  const refresh = useWorkspaceInvalidation(kind, id);
  return useMutation({
    mutationFn: (member: Pick<WorkspaceMember, "user_id" | "member_role">) =>
      removeEntityMember(kind, id, member),
    onSuccess: () => refresh({ memberships: true }),
  });
}
