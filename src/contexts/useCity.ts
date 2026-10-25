import { useContext } from "react";
import { CityContext, type CityContextValue } from "./cityContextObject";

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) {
    throw new Error("useCity must be used inside <CityProvider>");
  }
  return ctx;
}
