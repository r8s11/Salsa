import { createContext } from "react";
import type { City } from "../types/events";
import type { MetroSource, RankedMetro } from "../features/metros/model/metro";
import type { LocationStatus } from "../features/metros/hooks/useApproximateLocation";

export type CityContextValue = {
  /** Selected metro slug; null while resolving or when no metro is near. */
  city: City | null;
  /** Why this metro was chosen (explicit pick, profile, location, …). */
  source: MetroSource;
  /** True until the first choice is known; render skeletons, not a guess. */
  resolving: boolean;
  /** A person's pick. Persisted locally and never overridden by location. */
  setCity: (city: City) => void;
  /** Forget the manual pick and choose from the visitor's approximate area. */
  chooseNearMe: () => void;
  /** Active metros, nearest first when the area is known, else by inventory. */
  activeMetros: RankedMetro[];
  activeMetrosError: string | null;
  locationStatus: LocationStatus;
};

export const CityContext = createContext<CityContextValue | undefined>(undefined);
