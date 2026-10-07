import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicEntityPage from "../../pages/PublicEntityPage";
import { EntityDirectoryPage } from "./components/EntityDirectoryPage";
import type { EntityDetail } from "./model";

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
    rpc.mockResolvedValueOnce({ data: { ...detail, entity: { ...detail.entity, kind: "venue" } }, error: null });

    renderRoute(<PublicEntityPage kind="venue" />, "/v/ritmo-vivo", "/v/:slug");

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

describe("School profile", () => {
  // 2026-10-09 12:00 in New York; "Salsa Night" starts 22:00 the same evening.
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-09T16:00:00Z"), toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const school: EntityDetail = {
    ...detail,
    entity: { ...detail.entity, city: "Boston", website: "https://ritmo.example", instagram: "@ritmo.vivo" },
    upcoming: [
      ...detail.upcoming,
      { id: "event-2", slug: "on2-level-1", title: "On2 Level 1", event_date: "2026-10-13T23:30:00Z", city: "boston", location: null, image_url: null },
    ],
    related: [
      ...detail.related,
      { kind: "instructor", id: "i-1", name: "Ana Ferrer", slug: "ana-ferrer", description: null, image_url: null, city: "Boston" },
      { kind: "style", id: "s-1", name: "Salsa", slug: "salsa", description: null, image_url: null, city: null, category: "dance_style" },
      { kind: "style", id: "s-2", name: "Workshop", slug: "workshop", description: null, image_url: null, city: null, category: "event_attribute" },
      { kind: "city", id: "c-1", name: "Boston", slug: "boston", description: null, image_url: null, city: "boston" },
    ],
  };

  it("leads with the next night, in New York time, and where the door is", async () => {
    rpc.mockResolvedValueOnce({ data: school, error: null });

    renderRoute(<PublicEntityPage kind="school" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Ritmo Vivo" })).toBeInTheDocument();
    expect(screen.getByText("Dance school in Boston, MA")).toBeInTheDocument();
    const door = screen.getByRole("complementary", { name: "Visiting Ritmo Vivo" });
    const next = within(door).getByRole("link", { name: /Next up · Tonight, 10:00 PM/ });
    expect(next).toHaveAttribute("href", "/events/salsa-night");
    expect(within(door).getByText("1 Main St")).toBeInTheDocument();
    const directions = within(door).getByRole("link", { name: /Directions/ });
    expect(directions.getAttribute("href")).toContain(encodeURIComponent("Ritmo Vivo, 1 Main St, Boston, MA"));
    expect(within(door).getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://www.instagram.com/ritmo.vivo/");
  });

  it("lists the calendar with relative days and links the people and styles around it", async () => {
    rpc.mockResolvedValueOnce({ data: school, error: null });

    renderRoute(<PublicEntityPage kind="school" />);

    const calendar = (await screen.findByRole("heading", { name: "On the calendar" })).closest("section")!;
    expect(within(calendar).getByRole("link", { name: /On2 Level 1.*Tuesday · 7:30 PM/ })).toHaveAttribute("href", "/events/on2-level-1");
    expect(screen.getByRole("link", { name: "Ana Ferrer" })).toHaveAttribute("href", "/i/ana-ferrer");
    expect(screen.getByRole("link", { name: "Salsa" })).toHaveAttribute("href", "/styles/salsa");
    expect(screen.getByRole("link", { name: "Salsa Circle" })).toHaveAttribute("href", "/o/salsa-circle");
    expect(screen.getByRole("link", { name: "More dancing in Boston" })).toHaveAttribute("href", "/cities/boston");
  });

  it("reads honestly for a school with no address, links, or upcoming nights", async () => {
    const sparse: EntityDetail = {
      entity: { ...detail.entity, address: null, city: null, state_region: null, description: null },
      upcoming: [],
      past: [],
      related: [],
    };
    rpc.mockResolvedValueOnce({ data: sparse, error: null });

    renderRoute(<PublicEntityPage kind="school" />);

    expect(await screen.findByText("Dance school")).toBeInTheDocument();
    expect(screen.getByText("No classes on the calendar right now.")).toBeInTheDocument();
    expect(screen.getByText("Nothing listed yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Directions|Instagram|Website/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Past nights" })).not.toBeInTheDocument();
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
