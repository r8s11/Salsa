import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_METROS_QUERY_KEY } from "../../metros/hooks/useMetros";
import { fetchActiveMetros, fetchMetros } from "../../metros/api/metrosRepo";
import { fetchEntityDirectory } from "../entitiesRepo";
import { DiscoverHub } from "./DiscoverHub";

const cityState = vi.hoisted(() => ({ city: "boston", setCity: vi.fn() }));
vi.mock("../../../contexts/useCity", () => ({
  useCity: () => {
    const [city, updateCity] = useState(cityState.city);
    return { city, resolving: false, setCity: (slug: string) => { cityState.setCity(slug); updateCity(slug); } };
  },
}));
vi.mock("../../metros/api/metrosRepo", () => ({ fetchMetros: vi.fn(), fetchActiveMetros: vi.fn() }));
vi.mock("../entitiesRepo", () => ({ fetchEntityDirectory: vi.fn() }));

const boston = { slug: "boston", name: "Boston", stateRegion: "MA", countryCode: "US", latitude: 42.36, longitude: -71.06 };
const miami = { ...boston, slug: "miami", name: "Miami", stateRegion: "FL" };
const activeMiami = { ...miami, upcomingEventCount: 1, nextEventAt: "2099-01-01T00:00:00Z", distanceKm: null };
const school = { kind: "school" as const, id: "school-1", slug: "boston-school", name: "Boston School", description: null, image_url: null, city: "Boston" };

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><DiscoverHub /></MemoryRouter></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  cityState.city = "boston";
  vi.mocked(fetchMetros).mockResolvedValue([boston, miami]);
  vi.mocked(fetchActiveMetros).mockResolvedValue([activeMiami]);
  vi.mocked(fetchEntityDirectory).mockImplementation(async ({ kind, city }) => kind === "school" && city !== "miami" ? [school] : []);
});

describe("Discover city choices", () => {
  it("offers only active cities while preserving an empty selected city's label and directory", async () => {
    mount();
    const picker = screen.getByRole("group", { name: "Show the scene for a city" });
    expect(await within(picker).findByRole("button", { name: "Miami" })).toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: "Boston" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Boston", level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Boston School/ })).toBeInTheDocument();
    expect(cityState.setCity).not.toHaveBeenCalled();
    fireEvent.click(within(picker).getByRole("button", { name: "Miami" }));
    expect(cityState.setCity).toHaveBeenCalledWith("miami");
    expect(screen.getByRole("heading", { name: "Miami", level: 2 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("link", { name: /Boston School/ })).not.toBeInTheDocument());
    fireEvent.click(within(picker).getByRole("button", { name: "Every city" }));
    expect(screen.getByRole("heading", { name: "Every city", level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Boston School/ })).toBeInTheDocument();
    expect(cityState.setCity).toHaveBeenCalledTimes(1);
  });

  it("distinguishes first loading, failure, retrying, and confirmed zero inventory", async () => {
    let resolveInitial!: (value: typeof activeMiami[]) => void;
    let rejectInitial!: (error: Error) => void;
    vi.mocked(fetchActiveMetros).mockImplementationOnce(() => new Promise((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; }));
    mount();
    expect(screen.getByText("Loading cities with upcoming nights…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boston" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Miami" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Every city" })).toBeInTheDocument();
    await act(async () => rejectInitial(new Error("offline")));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load cities with upcoming nights.");
    vi.mocked(fetchActiveMetros).mockImplementationOnce(() => new Promise((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; }));
    act(() => screen.getByRole("button", { name: "Try again" }).focus());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Trying again…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t load cities with upcoming nights.");
    expect(screen.queryByText(/No cities have upcoming nights/)).not.toBeInTheDocument();
    await act(async () => rejectInitial(new Error("still offline")));
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus());
    vi.mocked(fetchActiveMetros).mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Trying again…" })).toBeDisabled();
    await act(async () => resolveInitial([]));
    expect(await screen.findByText("No cities have upcoming nights right now. You can still browse the directory.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Boston", level: 2 })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Every city" }));
    expect(screen.getByRole("heading", { name: "Every city", level: 2 })).toBeInTheDocument();
    expect(cityState.setCity).not.toHaveBeenCalled();
  });

  it("retains cached active city choices when a refresh fails", async () => {
    const client = mount();
    expect(await screen.findByRole("button", { name: "Miami" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Every city" }).focus());
    vi.mocked(fetchActiveMetros).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await client.invalidateQueries({ queryKey: ACTIVE_METROS_QUERY_KEY }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load cities with upcoming nights.");
    expect(screen.getByRole("button", { name: "Miami" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boston" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Every city" })).toHaveFocus();
  });
});
