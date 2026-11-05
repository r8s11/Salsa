import type { MetroSlug } from "./metro";
import type { SubLocation } from "./sublocation";

/** Aggregate inventory only; curated definitions still validate location selections. */
export interface ActiveLocation {
  city: MetroSlug;
  subLocation: SubLocation | null;
  neighborhood: string | null;
  upcomingEventCount: number;
}
