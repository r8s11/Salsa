import { createContext } from "react";
import type { City } from "../types/events";

export type CityContextValue = {
  city: City;
  setCity: (city: City) => void;
};

export const CityContext = createContext<CityContextValue | undefined>(undefined);
