import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EntityDirectorySections } from "./EntityDirectorySections";
import { fetchEntityDirectory } from "../entitiesRepo";
import type { PublicEntityKind, PublicEntityRef } from "../model";

vi.mock("../entitiesRepo", () => ({ fetchEntityDirectory: vi.fn() }));

const ref = (kind: PublicEntityKind, name: string, id: string): PublicEntityRef => ({
  kind, id, name, slug: id, description: null, image_url: null, city: "boston",
});

const renderSections = (onSeeAll = vi.fn()) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      <EntityDirectorySections label="Discover" search={{ query: "abc", city: "" }} onSeeAll={onSeeAll} />
    </MemoryRouter>
  </QueryClientProvider>,
);

describe("all-kinds directory search", () => {
  it("sections each kind, places first, so same-name listings and busy kinds stay apart", async () => {
    const events = Array.from({ length: 7 }, (_, index) => ({ ...ref("event", "ABC Studio Social", `e${index}`), event_date: `2026-12-0${index + 1}T20:00:00` }));
    vi.mocked(fetchEntityDirectory).mockImplementation(async ({ kind }) => ({
      event: events,
      organizer: [ref("organizer", "ABC Studio", "o1")],
      school: [ref("school", "ABC Studio", "s1")],
      venue: [ref("venue", "ABC Studio", "v1")],
    } as Partial<Record<PublicEntityKind, PublicEntityRef[]>>)[kind!] ?? []);
    const onSeeAll = vi.fn();
    renderSections(onSeeAll);

    expect((await screen.findAllByRole("heading", { level: 2 })).map((heading) => heading.textContent))
      .toEqual(["Schools", "Venues", "Organizers", "Events"]);
    expect(within(screen.getByRole("region", { name: "Venues" })).getByRole("link")).toHaveAttribute("href", "/v/v1");
    const eventSection = screen.getByRole("region", { name: "Events" });
    expect(within(eventSection).getAllByRole("link")).toHaveLength(6);
    expect(within(eventSection).getByText("Tue, Dec 1")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Venues" })).queryByRole("button")).not.toBeInTheDocument();
    within(eventSection).getByRole("button", { name: "See all events" }).click();
    expect(onSeeAll).toHaveBeenCalledWith("event");
  });
});
