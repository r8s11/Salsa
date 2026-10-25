import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import { fetchMyEntityClaims, fetchMyEntityMemberships } from "../api/workspacesRepo";

export const MY_ENTITY_MEMBERSHIPS_KEY = "my-entity-memberships";
export const MY_ENTITY_CLAIMS_KEY = "my-entity-claims";

/** Listings the signed-in person manages. Anonymous visitors never query. */
export function useMyEntityMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [MY_ENTITY_MEMBERSHIPS_KEY, user?.id ?? "anonymous"],
    queryFn: fetchMyEntityMemberships,
    enabled: user !== null,
    staleTime: 30_000,
  });
}

/** The signed-in person's own listing claims, newest first. */
export function useMyEntityClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [MY_ENTITY_CLAIMS_KEY, user?.id ?? "anonymous"],
    queryFn: fetchMyEntityClaims,
    enabled: user !== null,
    staleTime: 30_000,
  });
}
