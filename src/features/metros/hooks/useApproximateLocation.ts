import { useCallback, useEffect, useState } from "react";
import { coarsen, type Coordinates } from "../model/metro";

export type LocationStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

const POSITION_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 30 * 60 * 1000,
  timeout: 10_000,
};

function hasPermissionsApi(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function";
}

/**
 * Approximate visitor position for metro selection.
 *
 * - Never prompts on its own. With `silent`, it reads the position only when
 *   the browser already granted permission; otherwise it waits for
 *   `request()`, which runs from an explicit "Events near me" tap.
 * - One reading, no watch: nothing tracks the visitor.
 * - The position is rounded to ~11 km and held in memory only.
 *
 * `settled` is false while a silent check or a reading is in flight, so a
 * caller can hold its fallback instead of showing one city and jumping.
 */
export function useApproximateLocation(silent: boolean) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [silentChecked, setSilentChecked] = useState(() => !hasPermissionsApi());

  const read = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoords(null);
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords(coarsen(position.coords));
        setStatus("granted");
      },
      (error) => {
        setCoords(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      POSITION_OPTIONS
    );
  }, []);

  useEffect(() => {
    if (!silent || silentChecked || !hasPermissionsApi()) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (cancelled) return;
        if (permission.state === "granted") read();
        else if (permission.state === "denied") setStatus("denied");
      })
      .catch(() => {
        // Geolocation not queryable here: stay idle and never prompt.
      })
      .finally(() => {
        if (!cancelled) setSilentChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [silent, silentChecked, read]);

  return {
    status,
    coords,
    request: read,
    settled: (!silent || silentChecked) && status !== "locating",
  };
}
