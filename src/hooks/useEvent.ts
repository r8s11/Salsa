// Purpose: Wrapper hook for event data, scoped to the currently selected city.

import { useCity } from "../contexts/CityContext";
import { useSupabaseEvents } from "./useSupabaseEvents";

export function useEvents() {
  const { city } = useCity();
  return useSupabaseEvents(city);
}
