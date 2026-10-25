import { useQuery } from "@tanstack/react-query";
import { useMyOrganizers } from "./useMyOrganizers";
import { fetchOrganizerEvents } from "../api/organizerAccessRepo";
import type { DatabaseEvent } from "../../events/model/types";

export function useMyOrganizerEvents() {
  const { data: organizers = [], isLoading: organizersLoading } = useMyOrganizers();
  const organizerIds = organizers.map((organizer) => organizer.organizerId);
  const query = useQuery({
    queryKey: ["my-organizer-events", organizerIds],
    queryFn: async () => {
      const eventLists = await Promise.all(organizerIds.map(fetchOrganizerEvents));
      const byId = new Map<string, DatabaseEvent>();
      eventLists.flat().forEach((event) => byId.set(event.id, event));
      return [...byId.values()];
    },
    enabled: organizerIds.length > 0,
  });

  return {
    events: query.data ?? [],
    isLoading: organizersLoading || query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
