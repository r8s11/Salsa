import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import { buildClaimInbox } from "../claimInbox";
import { MY_ENTITY_CLAIMS_KEY, MY_ENTITY_MEMBERSHIPS_KEY, useMyEntityClaims, useMyEntityMemberships } from "./useMyEntityMemberships";

export function useClaimInbox() {
  const { user } = useAuth();
  const client = useQueryClient();
  const claims = useMyEntityClaims();
  const memberships = useMyEntityMemberships();
  const [refreshedUser, setRefreshedUser] = useState<string | null>(null);
  const userId = user?.id ?? null;
  useEffect(() => {
    let active = true;
    if (userId) {
      void Promise.all([
        client.refetchQueries({ queryKey: [MY_ENTITY_CLAIMS_KEY, userId], exact: true }),
        client.refetchQueries({ queryKey: [MY_ENTITY_MEMBERSHIPS_KEY, userId], exact: true }),
      ]).finally(() => { if (active) setRefreshedUser(userId); });
    }
    return () => { active = false; };
  }, [client, userId]);
  return {
    items: buildClaimInbox(claims.data ?? []),
    isLoading: refreshedUser !== userId || claims.isPending || memberships.isPending || claims.isFetching || memberships.isFetching,
    isError: claims.isError || memberships.isError,
    refetch: () => { void claims.refetch(); void memberships.refetch(); },
  };
}
