// Purpose: Wrapper hook for event data, scoped to the currently selected city.

import { useCity } from "../contexts/CityContext";
import { useEventsQuery } from "../features/events/hooks/useEventsQuery";

export function useEvents() {
  const { city } = useCity();
  return useEventsQuery(city);
}
