import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type City = "boston" | "new-york-city";

const STORAGE_KEY = "salsa.city";
const VALID: readonly City[] = ["boston", "new-york-city"];

type CityContextValue = {
  city: City;
  setCity: (city: City) => void;
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

function readStoredCity(): City {
  if (typeof window === "undefined") return "boston";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as City) ? (stored as City) : "boston";
}

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<City>(readStoredCity);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, city);
  }, [city]);

  const setCity = useCallback((next: City) => setCityState(next), []);

  return (
    <CityContext.Provider value={{ city, setCity }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) {
    throw new Error("useCity must be used inside <CityProvider>");
  }
  return ctx;
}
