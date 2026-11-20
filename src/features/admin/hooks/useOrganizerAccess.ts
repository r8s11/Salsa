import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignOrganizerMember,
  fetchOrganizerTeam,
  fetchUserOrganizerMemberships,
} from "../api/organizerAssignmentRepo";

export function useUserOrganizerMemberships(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "organizer-memberships", userId],
    queryFn: () => fetchUserOrganizerMemberships(userId!),
    enabled: userId !== null,
  });
}

export function useOrganizerTeam(organizerId: string | null) {
  return useQuery({
    queryKey: ["admin", "organizer-team", organizerId],
    queryFn: () => fetchOrganizerTeam(organizerId!),
    enabled: organizerId !== null,
  });
}

export function useAssignOrganizerMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignOrganizerMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizer-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizer-team"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "auditLog"] });
    },
  });
}
