import { supabase } from "../../../lib/supabase";
import type {
  AdminEntityClaim,
  ClaimRelationship,
  ClaimStatus,
  EntityClaim,
  EntityMemberRole,
  EntityMembership,
  EntityWorkspace,
  ManagedKind,
  OfferingType,
  PricePlanInput,
  PrivateOfferInput,
  ProfilePatch,
  PublicSchoolOfferings,
  SchoolClassInput,
  WorkspaceMember,
} from "../model";

/** The database refused the caller (42501): not a member, or the role is too low. */
export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "42501") throw new WorkspaceAccessError(error.message);
    throw new Error(error.message);
  }
  return data as T;
}

export function fetchMyEntityMemberships(): Promise<EntityMembership[]> {
  return call<EntityMembership[]>("my_entity_memberships");
}

export function fetchEntityWorkspace(kind: ManagedKind, id: string): Promise<EntityWorkspace> {
  return call<EntityWorkspace>("entity_workspace", { p_kind: kind, p_id: id });
}

export function saveEntityProfile<K extends ManagedKind>(kind: K, id: string, patch: ProfilePatch[K]): Promise<void> {
  return call<void>("entity_profile_save", { p_kind: kind, p_id: id, p_payload: patch });
}

type OfferingInput = { class: SchoolClassInput; private: PrivateOfferInput; plan: PricePlanInput };

/** Creates when `offeringId` is null; returns the saved offering's id. */
export function saveSchoolOffering<T extends OfferingType>(
  schoolId: string,
  type: T,
  offeringId: string | null,
  input: OfferingInput[T],
): Promise<string> {
  return call<string>("school_offering_save", { p_school_id: schoolId, p_type: type, p_id: offeringId, p_payload: input });
}

export function deleteSchoolOffering(schoolId: string, type: OfferingType, offeringId: string): Promise<void> {
  return call<void>("school_offering_delete", { p_school_id: schoolId, p_type: type, p_id: offeringId });
}

export function fetchPublicSchoolOfferings(slug: string): Promise<PublicSchoolOfferings | null> {
  return call<PublicSchoolOfferings | null>("public_school_offerings", { p_slug: slug });
}

/** Adds an existing account by email; the RPC refuses unknown emails. */
export function addEntityMember(kind: ManagedKind, id: string, email: string, role: EntityMemberRole): Promise<string> {
  return call<string>("entity_member_add", { p_kind: kind, p_id: id, p_email: email, p_role: role });
}

export function updateEntityMember(kind: ManagedKind, id: string, userId: string, role: EntityMemberRole): Promise<void> {
  return call<void>("entity_member_update", { p_kind: kind, p_id: id, p_user_id: userId, p_role: role, p_remove: false });
}

export function removeEntityMember(kind: ManagedKind, id: string, member: Pick<WorkspaceMember, "user_id" | "member_role">): Promise<void> {
  return call<void>("entity_member_update", {
    p_kind: kind,
    p_id: id,
    p_user_id: member.user_id,
    p_role: member.member_role,
    p_remove: true,
  });
}

export function submitEntityClaim(kind: ManagedKind, id: string, relationship: ClaimRelationship, message: string): Promise<string> {
  return call<string>("entity_claim_submit", { p_kind: kind, p_id: id, p_relationship: relationship, p_message: message });
}

export function fetchMyEntityClaims(): Promise<EntityClaim[]> {
  return call<EntityClaim[]>("my_entity_claims");
}

/** `null` lists every claim regardless of status. */
export function fetchAdminEntityClaims(status: ClaimStatus | null): Promise<AdminEntityClaim[]> {
  return call<AdminEntityClaim[]>("admin_entity_claims", { p_status: status });
}

export function fetchPendingEntityClaimCount(): Promise<number> {
  return call<number>("admin_pending_entity_claim_count");
}

export function reviewEntityClaim(claimId: string, approve: boolean, note: string | null): Promise<{ member_role: EntityMemberRole | null }> {
  return call<{ member_role: EntityMemberRole | null }>("admin_review_entity_claim", {
    p_claim_id: claimId,
    p_approve: approve,
    p_note: note,
  });
}

export function fetchAdminEntityMembers(kind: ManagedKind, id: string): Promise<WorkspaceMember[]> {
  return call<WorkspaceMember[]>("admin_entity_members", { p_kind: kind, p_id: id });
}
