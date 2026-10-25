import { useQuery } from "@tanstack/react-query";
import { fetchActiveDanceStyles } from "../api/danceStylesRepo";

export const DANCE_STYLE_OPTIONS_KEY = "workspace-dance-style-options";

/** Active dance styles a school may tag a class with. */
export function useDanceStyleOptions() {
  return useQuery({
    queryKey: [DANCE_STYLE_OPTIONS_KEY],
    queryFn: fetchActiveDanceStyles,
    staleTime: 5 * 60_000,
  });
}
