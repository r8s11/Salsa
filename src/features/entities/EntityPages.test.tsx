import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicEntityPage from "../../pages/PublicEntityPage";
import { EntityDirectoryPage } from "./components/EntityDirectoryPage";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("../metros/hooks/useMetros", () => ({
  useMetros: () => ({ metros: [{ slug: "boston", name: "Boston" }], loading: false, error: null }),
}));

const detail = {
  entity: {
    kind: "school" as const, id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo",
    description: "Community dance school", image_url: null, city: "boston", state_region: "MA",
    country: "US", address: "1 Main St", website: null, instagram: null,
  },
  upcoming: [{ id: "event-1", slug: "salsa-night", title: "Salsa Night", event_date: "2026-10-10T02:00:00Z", city: "boston", location: "Club", image_url: null }],
  past: [],
  related: [{ kind: "organizer" as const, id: "organizer-1", name: "Salsa Circle", slug: "salsa-circle", description: null, image_url: null, city: "boston" }],
};

function renderRoute(element: ReactElement, initialPath = "/s/ritmo-vivo", routePattern = "/s/:slug") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes><Route path={routePattern} element={element} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { rpc.mockReset(); });

describe("PublicEntityPage", () => {
  it("renders the entity description and approved upcoming event links", async () => {
    rpc.mockResolvedValueOnce({ data: detail, error: null });

    renderRoute(<PublicEntityPage kind="school" />);

    expect(await screen.findByRole("heading", { name: "Ritmo Vivo" })).toBeInTheDocument();
    expect(screen.getByText("Community dance school")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Salsa Night/ })).toHaveAttribute("href", "/events/salsa-night");
    expect(screen.getByRole("link", { name: /Salsa Circle/ })).toHaveAttribute("href", "/o/salsa-circle");
    expect(screen.getByText(/no past events listed/i)).toBeInTheDocument();
  });

  it("shows a loading announcement while detail data is pending", async () => {
    const result = Promise.withResolvers<{ data: typeof detail; error: null }>();
    rpc.mockReturnValueOnce(result.promise);

    renderRoute(<PublicEntityPage kind="school" />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading school/i);
    await act(async () => result.resolve({ data: detail, error: null }));
  });

  it("announces an unknown entity as not found", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    renderRoute(<PublicEntityPage kind="school" />);

    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  it("lets visitors recover from a failed detail lookup", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    rpc.mockResolvedValueOnce({ data: detail, error: null });

    renderRoute(<PublicEntityPage kind="school" />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("heading", { name: "Ritmo Vivo" })).toBeInTheDocument();
  });
});

describe("EntityDirectoryPage", () => {
  it("filters the cross-kind directory by query and canonical metro city", async () => {
    rpc.mockImplementation((_name: string, args: { p_query: string; p_city: string | null }) => {
      return Promise.resolve({ data: args.p_query === "Ritmo" && args.p_city === "boston" ? [detail.entity] : [], error: null });
    });

    renderRoute(<EntityDirectoryPage />, "/discover", "*");

    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), { target: { value: "Ritmo" } });
    fireEvent.change(screen.getByRole("combobox", { name: /city/i }), { target: { value: "boston" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByRole("link", { name: /Ritmo Vivo/i })).toHaveAttribute("href", "/s/ritmo-vivo");
  });

  it("advances through directory results with the next-page control", async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => ({
      ...detail.entity,
      id: `school-${index}`,
      name: `Dance school ${index}`,
      slug: `dance-school-${index}`,
    }));
    const nextItem = { ...detail.entity, id: "school-next", name: "Next page school", slug: "next-page-school" };
    rpc.mockResolvedValueOnce({ data: firstPage, error: null }).mockResolvedValueOnce({ data: [nextItem], error: null });

    renderRoute(<EntityDirectoryPage kind="school" />, "/schools", "*");

    expect(await screen.findByRole("link", { name: /Dance school 0/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("link", { name: /Next page school/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dance school 0/ })).not.toBeInTheDocument();
  });

  it("shows an explicit empty state for a per-kind directory", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });

    renderRoute(<EntityDirectoryPage kind="instructor" />, "/instructors", "*");

    expect(await screen.findByText(/no instructors found/i)).toBeInTheDocument();
  });

  it("offers a retry after the directory read fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    rpc.mockResolvedValueOnce({ data: [detail.entity], error: null });

    renderRoute(<EntityDirectoryPage kind="school" />, "/schools", "*");
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("link", { name: /Ritmo Vivo/i })).toBeInTheDocument();
  });
});
