import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { City } from "../types/events";
import { CityContext } from "./cityContextObject";
import { useAuth } from "./useAuth";
import { useOwnProfile } from "../features/account/hooks/useOwnProfile";
import { useActiveMetros, useMetros } from "../features/metros/hooks/useMetros";
import { useApproximateLocation } from "../features/metros/hooks/useApproximateLocation";
import { chooseMetro, rankMetros } from "../features/metros/model/metro";

export type { City };

// Only a hand-picked metro is remembered. The previous key stored whatever
// city was on screen, including the old hardcoded default, so it says
// nothing about what the visitor chose and is dropped.
const STORAGE_KEY = "salsa.metro";
const LEGACY_STORAGE_KEY = "salsa.city";

function readStoredCity(): City | null {
  if (typeof window === "undefined") return null;
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return window.localStorage.getItem(STORAGE_KEY);
}

export function CityProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useOwnProfile(user?.id);
  const { metros, loading: metrosLoading } = useMetros();
  const { activeMetros, loading: activeLoading, error: activeMetrosError } = useActiveMetros();

  const [explicit, setExplicit] = useState<City | null>(null);
  const [stored, setStored] = useState<City | null>(readStoredCity);
  // "Events near me" outranks the profile city for the rest of the session.
  const [ignoreProfile, setIgnoreProfile] = useState(false);

  const profileCity = ignoreProfile ? null : (profile?.city ?? null);
  const hasPreference = Boolean(explicit || profileCity || stored);
  const profilePending = authLoading || (!ignoreProfile && profileLoading);
  const location = useApproximateLocation(!hasPreference && !profilePending);

  const choice = useMemo(
    () =>
      chooseMetro({
        explicit,
        profile: profileCity,
        stored,
        coords: location.coords,
        metros,
        active: activeMetros,
      }),
    [explicit, profileCity, stored, location.coords, metros, activeMetros]
  );

  const resolving =
    metrosLoading ||
    profilePending ||
    (choice.source !== "explicit" && choice.source !== "profile" && choice.source !== "stored"
      ? activeLoading || !location.settled
      : false);

  const ranked = useMemo(
    () => rankMetros(activeMetros, location.coords),
    [activeMetros, location.coords]
  );

  useEffect(() => {
    if (stored) window.localStorage.setItem(STORAGE_KEY, stored);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [stored]);

  const setCity = useCallback((next: City) => {
    setExplicit(next);
    setStored(next);
  }, []);

  const requestLocation = location.request;
  const chooseNearMe = useCallback(() => {
    setExplicit(null);
    setStored(null);
    setIgnoreProfile(true);
    requestLocation();
  }, [requestLocation]);

  const value = useMemo(
    () => ({
      city: resolving ? null : choice.slug,
      source: choice.source,
      resolving,
      setCity,
      chooseNearMe,
      activeMetros: ranked,
      activeMetrosError,
      locationStatus: location.status,
    }),
    [
      resolving,
      choice,
      setCity,
      chooseNearMe,
      ranked,
      activeMetrosError,
      location.status,
    ]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
