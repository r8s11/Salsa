import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import { fetchMyOrganizers } from "../api/organizerAccessRepo";

/**
 * Session-scoped organizer memberships for the signed-in user. Anonymous
 * visitors never query: RLS would return nothing anyway.
 */
export function useMyOrganizers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-organizers", user?.id ?? "anonymous"],
    queryFn: fetchMyOrganizers,
    enabled: user !== null,
    staleTime: 30_000,
  });
}
