// Purpose: Wrapper hook for event data, scoped to the currently selected metro.

import { useCity } from "../../../contexts/useCity";
import { useEventsQuery } from "./useEventsQuery";

export function useEvents() {
  const { city, subLocation, neighborhood, resolving } = useCity();
  const query = useEventsQuery(city, subLocation, neighborhood);
  // While the metro is still being chosen the feed is loading, not empty.
  return { ...query, loading: query.loading || resolving };
}
