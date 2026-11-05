import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { City } from "../types/events";
import { CityContext } from "./cityContextObject";
import { useAuth } from "./useAuth";
import { useOwnProfile } from "../features/account/hooks/useOwnProfile";
import { useActiveMetros, useMetros } from "../features/metros/hooks/useMetros";
import { useApproximateLocation } from "../features/metros/hooks/useApproximateLocation";
import { chooseMetro, rankMetros } from "../features/metros/model/metro";
import {
  normalizeSubLocation,
  type SubLocation,
} from "../features/metros/model/sublocation";
import { normalizeNeighborhood } from "../features/metros/model/neighborhood";

export type { City };

// Only a hand-picked metro is remembered. The previous key stored whatever
// city was on screen, including the old hardcoded default, so it says
// nothing about what the visitor chose and is dropped.
const STORAGE_KEY = "salsa.metro";
const SUBLOCATION_STORAGE_KEY = "salsa.sublocation";
const NEIGHBORHOOD_STORAGE_KEY = "salsa.neighborhood";
const LEGACY_STORAGE_KEY = "salsa.city";

function readStoredCity(): City | null {
  if (typeof window === "undefined") return null;
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return window.localStorage.getItem(STORAGE_KEY);
}

function readStoredSubLocation(): SubLocation | null {
  if (typeof window === "undefined") return null;
  return normalizeSubLocation(
    window.localStorage.getItem(STORAGE_KEY),
    window.localStorage.getItem(SUBLOCATION_STORAGE_KEY)
  );
}

export function CityProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useOwnProfile(user?.id);
  const { metros, loading: metrosLoading } = useMetros();
  const {
    activeMetros,
    loading: activeLoading,
    fetching: activeFetching,
    loadFailed: activeLoadFailed,
    error: activeMetrosError,
    refetch: refetchActiveMetros,
  } = useActiveMetros();

  const [explicit, setExplicit] = useState<City | null>(null);
  const [explicitSubLocation, setExplicitSubLocation] = useState<SubLocation | null>(null);
  const [explicitNeighborhood, setExplicitNeighborhood] = useState<string | null>(null);
  const [stored, setStored] = useState<City | null>(readStoredCity);
  const [storedSubLocation, setStoredSubLocation] = useState<SubLocation | null>(
    readStoredSubLocation
  );
  const [storedNeighborhood, setStoredNeighborhood] = useState<string | null>(() =>
    typeof window === "undefined" ? null : normalizeNeighborhood(
      stored, normalizeSubLocation(stored, storedSubLocation),
      window.localStorage.getItem(NEIGHBORHOOD_STORAGE_KEY)
    )
  );
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
  const subLocation = normalizeSubLocation(
    choice.slug,
    explicit ? explicitSubLocation : stored === choice.slug ? storedSubLocation : null
  );
  const neighborhood = normalizeNeighborhood(
    choice.slug, subLocation,
    explicit ? explicitNeighborhood : stored === choice.slug ? storedNeighborhood : null
  );

  useEffect(() => {
    if (stored) window.localStorage.setItem(STORAGE_KEY, stored);
    else window.localStorage.removeItem(STORAGE_KEY);
    if (stored && storedSubLocation) {
      window.localStorage.setItem(SUBLOCATION_STORAGE_KEY, storedSubLocation);
    } else {
      window.localStorage.removeItem(SUBLOCATION_STORAGE_KEY);
    }
    if (stored && storedNeighborhood) {
      window.localStorage.setItem(NEIGHBORHOOD_STORAGE_KEY, storedNeighborhood);
    } else {
      window.localStorage.removeItem(NEIGHBORHOOD_STORAGE_KEY);
    }
  }, [stored, storedSubLocation, storedNeighborhood]);

  const setCity = useCallback((next: City, nextSubLocation: SubLocation | null = null, nextNeighborhood: string | null = null) => {
    const validSubLocation = normalizeSubLocation(next, nextSubLocation);
    const validNeighborhood = normalizeNeighborhood(next, validSubLocation, nextNeighborhood);
    setExplicit(next);
    setExplicitSubLocation(validSubLocation);
    setStored(next);
    setStoredSubLocation(validSubLocation);
    setExplicitNeighborhood(validNeighborhood);
    setStoredNeighborhood(validNeighborhood);
  }, []);

  const requestLocation = location.request;
  const chooseNearMe = useCallback(() => {
    setExplicit(null);
    setExplicitSubLocation(null);
    setStored(null);
    setStoredSubLocation(null);
    setExplicitNeighborhood(null);
    setStoredNeighborhood(null);
    setIgnoreProfile(true);
    requestLocation();
  }, [requestLocation]);

  const value = useMemo(
    () => ({
      city: resolving ? null : choice.slug,
      subLocation: resolving ? null : subLocation,
      neighborhood: resolving ? null : neighborhood,
      source: choice.source,
      resolving,
      activeMetrosLoadFailed: activeLoadFailed,
      activeMetrosLoading: activeLoading,
      activeMetrosFetching: activeFetching,
      setCity,
      refetchActiveMetros,
      chooseNearMe,
      activeMetros: ranked,
      activeMetrosError,
      locationStatus: location.status,
    }),
    [
      resolving,
      choice,
      subLocation,
      neighborhood,
      activeLoadFailed,
      activeLoading,
      activeFetching,
      setCity,
      refetchActiveMetros,
      chooseNearMe,
      ranked,
      activeMetrosError,
      location.status,
    ]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
