// Purpose: Wrapper hook for event data, scoped to the currently selected city.

import { useCity } from "../../../contexts/useCity";
import { useEventsQuery } from "./useEventsQuery";

export function useEvents() {
  const { city } = useCity();
  return useEventsQuery(city);
}
