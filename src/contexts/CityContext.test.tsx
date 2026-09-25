import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityProvider } from "./CityContext";
import { useCity } from "./useCity";
import type { ActiveMetro } from "../features/metros/model/metro";

vi.mock("./useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

const active: ActiveMetro[] = [
  {
    slug: "new-york-city",
    name: "New York City",
    stateRegion: "NY",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    upcomingEventCount: 7,
    nextEventAt: "2099-01-02T00:00:00Z",
  },
  {
    slug: "boston",
    name: "Boston",
    stateRegion: "MA",
    countryCode: "US",
    latitude: 42.3601,
    longitude: -71.0589,
    upcomingEventCount: 3,
    nextEventAt: "2099-01-01T00:00:00Z",
  },
  {
    slug: "philadelphia",
    name: "Philadelphia",
    stateRegion: "PA",
    countryCode: "US",
    latitude: 39.9526,
    longitude: -75.1652,
    upcomingEventCount: 2,
    nextEventAt: "2099-01-03T00:00:00Z",
  },
];

vi.mock("../features/metros/api/metrosRepo", () => ({
  fetchMetros: vi.fn(async () => active),
  fetchActiveMetros: vi.fn(async () => active),
}));

type PermissionState = "granted" | "denied" | "prompt";
const getCurrentPosition = vi.fn();

function mockGeolocation(permission: PermissionState, position?: { lat: number; lon: number }) {
  getCurrentPosition.mockImplementation((success, failure) => {
    if (permission === "denied" || !position) {
      failure({ code: 1, PERMISSION_DENIED: 1 });
      return;
    }
    success({ coords: { latitude: position.lat, longitude: position.lon } });
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn(async () => ({ state: permission })) },
  });
}

const NEAR_PHILLY = { lat: 39.96, lon: -75.2 };

function renderCity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <CityProvider>{children}</CityProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useCity(), { wrapper });
}

beforeEach(() => {
  window.localStorage.clear();
  getCurrentPosition.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CityProvider", () => {
  it("uses an already-granted approximate location to pick the nearest active metro", async () => {
    mockGeolocation("granted", NEAR_PHILLY);
    const { result } = renderCity();
    await waitFor(() => expect(result.current.city).toBe("philadelphia"));
    expect(result.current.source).toBe("location");
    // Explorer lists the nearest first.
    expect(result.current.activeMetros[0].slug).toBe("philadelphia");
  });

  it("never prompts for location on load when permission has not been given", async () => {
    mockGeolocation("prompt");
    const { result } = renderCity();
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ city: "new-york-city", source: "inventory" });
  });

  it("keeps the homepage usable when location is denied", async () => {
    mockGeolocation("denied");
    const { result } = renderCity();
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current).toMatchObject({
      city: "new-york-city",
      source: "inventory",
      locationStatus: "denied",
    });
  });

  it("persists a manual pick and lets it outrank location on the next visit", async () => {
    mockGeolocation("granted", NEAR_PHILLY);
    const first = renderCity();
    await waitFor(() => expect(first.result.current.city).toBe("philadelphia"));

    act(() => first.result.current.setCity("boston"));
    await waitFor(() => expect(first.result.current.city).toBe("boston"));
    expect(first.result.current.source).toBe("explicit");
    expect(window.localStorage.getItem("salsa.metro")).toBe("boston");
    first.unmount();

    getCurrentPosition.mockClear();
    const second = renderCity();
    await waitFor(() => expect(second.result.current.resolving).toBe(false));
    expect(second.result.current).toMatchObject({ city: "boston", source: "stored" });
    // A remembered pick means location is not even read.
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns to the visitor's area on Events near me", async () => {
    mockGeolocation("granted", NEAR_PHILLY);
    window.localStorage.setItem("salsa.metro", "boston");
    const { result } = renderCity();
    await waitFor(() => expect(result.current.city).toBe("boston"));

    act(() => result.current.chooseNearMe());
    await waitFor(() => expect(result.current.city).toBe("philadelphia"));
    expect(result.current.source).toBe("location");
    expect(window.localStorage.getItem("salsa.metro")).toBeNull();
  });
});
