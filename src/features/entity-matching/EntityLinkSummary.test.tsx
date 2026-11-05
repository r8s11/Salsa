import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntityLinkSummary from "./EntityLinkSummary";
import type { EntityMatch, EntityReview, EntityReviewItem } from "./entityReview";

const client = vi.hoisted(() => ({ searchEntityMatches: vi.fn(), reconcileEntities: vi.fn() }));
vi.mock("./entityReviewClient", () => client);

const HALL: EntityMatch = { id: "22222222-2222-4222-8222-222222222222", name: "Rhythm Hall" };
const CASA: EntityMatch = { id: "33333333-3333-4333-8333-333333333333", name: "Casa Latina" };

const item = (name: string, overrides: Partial<EntityReviewItem> = {}): EntityReviewItem => ({
  candidate: { name },
  state: "POSSIBLE MATCH",
  matches: [],
  decision: "pending",
  selected_id: null,
  ...overrides,
});

const review = (): EntityReview => ({
  venue: item("Rhythm Hall Boston", { decision: "existing", selected_id: HALL.id, matches: [HALL] }),
  organizer: item("Casa", { matches: [CASA] }),
  instructors: [item("Luis Ortega", { decision: "new", state: "NEW" }), item("Ana", { decision: "removed" })],
  school: null,
});

function Harness({ initial, onReview }: { initial: EntityReview; onReview?: (r: EntityReview) => void }) {
  const [current, setCurrent] = useState(initial);
  return (
    <EntityLinkSummary
      review={current}
      mode="public"
      addable
      onChange={(next) => {
        setCurrent(next);
        onReview?.(next);
      }}
    />
  );
}

const row = (name: RegExp | string) => {
  const rows = screen.getAllByRole("listitem").filter((li) => li.classList.contains("entity-links__row"));
  const found = rows.find((li) =>
    typeof name === "string" ? li.textContent?.includes(name) : name.test(li.textContent ?? "")
  );
  if (!found) throw new Error(`row ${String(name)} not found`);
  return within(found);
};

describe("EntityLinkSummary", () => {
  beforeEach(() => {
    client.searchEntityMatches.mockReset().mockResolvedValue([]);
  });

  it("states each link's decision in words, matching the review one row per entry", () => {
    render(<Harness initial={review()} />);
    expect(screen.getByRole("heading", { name: "Linked to this event" })).toBeInTheDocument();
    expect(row("Rhythm Hall").getByText("Existing — will be linked")).toBeInTheDocument();
    expect(row("Rhythm Hall").getByText("From “Rhythm Hall Boston”")).toBeInTheDocument();
    expect(row("Luis Ortega").getByText("Suggested new — moderator reviews")).toBeInTheDocument();
    expect(row("Ana").getByText("Not linked")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").filter((li) => li.classList.contains("entity-links__row"))).toHaveLength(4);
  });

  it("flags undecided items before submit and explains a public submit is still allowed", () => {
    render(<Harness initial={review()} />);
    expect(screen.getByText("1 item needs your choice.")).toBeInTheDocument();
    expect(screen.getByText(/You can still submit/)).toBeInTheDocument();
    expect(row("Casa").getByText("Needs your choice")).toBeInTheDocument();
  });

  it("reads undecided items as left undecided once submitted", () => {
    render(<EntityLinkSummary review={review()} mode="public" heading="Sent with your event" />);
    // Read-only: no actions anywhere.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("1 left undecided.")).toBeInTheDocument();
    expect(row("Casa").getByText("Left undecided")).toBeInTheDocument();
  });

  it("settles a pending item inline and the change is the review that gets sent", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness initial={review()} onReview={onReview} />);

    await user.click(screen.getByRole("button", { name: "Link Casa Latina as the organizer" }));
    const sent = onReview.mock.lastCall![0] as EntityReview;
    expect(sent.organizer).toMatchObject({ decision: "existing", selected_id: CASA.id, explicit: true });
    expect(sent.organizer).not.toHaveProperty("moderator_confirmed");
    expect(row("Casa Latina").getByText("Existing — will be linked")).toBeInTheDocument();
    expect(screen.queryByText(/needs your choice/)).not.toBeInTheDocument();
  });

  it("removes and restores a link", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness initial={review()} onReview={onReview} />);

    await user.click(screen.getByRole("button", { name: "Don’t link Luis Ortega" }));
    expect(onReview.mock.lastCall![0].instructors[0].decision).toBe("removed");
    await user.click(screen.getByRole("button", { name: "Undo remove Luis Ortega" }));
    expect(onReview.mock.lastCall![0].instructors[0].decision).toBe("pending");
  });

  it("adds a school by picking a listed record from the suggestions", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const school: EntityMatch = { id: "44444444-4444-4444-8444-444444444444", name: "Salsa Lab", city: "Boston" };
    client.searchEntityMatches.mockResolvedValue([school]);
    render(<Harness initial={review()} onReview={onReview} />);

    await user.click(screen.getByRole("button", { name: "School" }));
    await user.type(screen.getByLabelText("School name"), "salsa");
    await user.click(await screen.findByRole("button", { name: "Link Salsa Lab as the school" }));

    expect(client.searchEntityMatches).toHaveBeenCalledWith("school", "salsa");
    expect(onReview.mock.lastCall![0].school).toMatchObject({
      candidate: { name: "salsa" },
      decision: "existing",
      selected_id: school.id,
    });
  });

  it("still lets a name be suggested as new when the lookup fails, and says the lookup failed", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    client.searchEntityMatches.mockRejectedValue(new Error("offline"));
    render(<Harness initial={{ venue: null, organizer: null, instructors: [], school: null }} onReview={onReview} />);

    await user.type(screen.getByLabelText("Organizer name"), "Casa Nueva");
    expect(await screen.findByText(/couldn’t look up existing organizers/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try the lookup again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suggest as new" }));

    expect(onReview.mock.lastCall![0].organizer).toMatchObject({
      candidate: { name: "Casa Nueva" },
      decision: "new",
      state: "NEEDS REVIEW",
    });
  });

  it("shows a typed venue as text only, never implying a link", () => {
    render(
      <EntityLinkSummary
        review={{ venue: null, organizer: null, instructors: [], school: null }}
        mode="public"
        typedVenue="My Own Hall"
      />
    );
    expect(row("My Own Hall").getByText("Typed only — not linked")).toBeInTheDocument();
  });
});
