// Shared registered inventory for legacy page tests. Dedicated CityContext
// tests exercise real hooks against mocked repository responses instead.
const metros = [
  { slug: "boston", name: "Boston", stateRegion: "MA", countryCode: "US", latitude: 42.36, longitude: -71.06 },
  { slug: "new-york-city", name: "New York City", stateRegion: "NY", countryCode: "US", latitude: 40.71, longitude: -74.01 },
  { slug: "miami", name: "Miami", stateRegion: "FL", countryCode: "US", latitude: 25.76, longitude: -80.19 },
];

const activeMetros = metros.map((metro) => ({
  ...metro,
  upcomingEventCount: 2,
  nextEventAt: "2099-01-01T00:00:00Z",
  distanceKm: null,
}));

export function useMetros() {
  return { metros, loading: false, error: null };
}

export function useActiveMetros() {
  return { activeMetros, loading: false, error: null, refetch: async () => undefined };
}

export function useMetroName() {
  return (slug: string | null | undefined) =>
    metros.find((metro) => metro.slug === slug)?.name ?? slug ?? "";
}
