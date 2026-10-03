import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EntityMatch, EntityReview, EntityReviewItem } from "./entityReview";
import EntityReviewSection, { type EntityReviewSectionProps } from "./EntityReviewSection";

const client = vi.hoisted(() => ({
  reconcileEntities: vi.fn(),
  searchEntityMatches: vi.fn(),
}));
vi.mock("./entityReviewClient", () => client);

const studio: EntityMatch = {
  id: "v1",
  name: "Studio 5",
  address: "5 Main St",
  city: "Boston",
  state_region: "MA",
  website: "studio5.example",
  instagram: "@studio5",
};
const hall: EntityMatch = { ...studio, id: "v2", name: "Rhythm Hall", address: "9 Elm St" };

const baseReview = (): EntityReview => ({
  venue: {
    candidate: { name: "studio five", address: "5 Main Street", city: "Boston" },
    state: "POSSIBLE MATCH",
    matches: [studio],
    decision: "pending",
    selected_id: null,
  },
  organizer: null,
  instructors: [
    {
      candidate: { name: "Ana Rivera" },
      state: "NEW",
      matches: [],
      decision: "pending",
      selected_id: null,
    },
  ],
  school: null,
});

function Harness({
  initial = baseReview(),
  onReview,
  ...props
}: { initial?: EntityReview; onReview?: (review: EntityReview) => void } & Partial<
  Omit<EntityReviewSectionProps, "review" | "onChange">
>) {
  const [review, setReview] = useState(initial);
  return (
    <form onSubmit={(event) => event.preventDefault()} data-testid="parent-form">
      <EntityReviewSection
        review={review}
        onChange={(next) => {
          onReview?.(next);
          setReview(next);
        }}
        {...props}
      />
    </form>
  );
}

const venueGroup = () => screen.getByRole("group", { name: /^Venue:/ });

// The review most recently handed to onChange. Slots are asserted on directly, so
// they are typed as present; a missing slot fails the assertion rather than the type.
type LatestReview = EntityReview & {
  venue: EntityReviewItem;
  organizer: EntityReviewItem;
  school: EntityReviewItem;
};
const latest = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls[spy.mock.calls.length - 1][0] as LatestReview;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EntityReviewSection structure", () => {
  it("names all four sections and explains each state in words", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Venue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organizer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Instructors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "School" })).toBeInTheDocument();
    expect(screen.getByText("No organizer was found on the flyer.")).toBeInTheDocument();
    expect(within(venueGroup()).getByText("Possible match")).toBeInTheDocument();
    expect(
      within(venueGroup()).getByText("Similar records exist. Pick one, or confirm this one is new.")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /^Instructor: Ana Rivera/ })).getByText(
        "Not in our records"
      )
    ).toBeInTheDocument();
  });

  it("disables every control when disabled", () => {
    render(<Harness disabled />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    for (const input of screen.getAllByRole("searchbox")) expect(input).toBeDisabled();
    for (const input of screen.getAllByLabelText("Name")) expect(input).toBeDisabled();
  });
});

describe("accepting, choosing, creating, removing", () => {
  it("accepts an existing match, announces it, and toggles back to undecided", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness onReview={onReview} />);
    const accept = within(venueGroup()).getByRole("button", { name: "Use Studio 5 as the venue" });
    expect(accept).toHaveAttribute("aria-pressed", "false");

    await user.click(accept);

    expect(onReview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        venue: expect.objectContaining({ decision: "existing", selected_id: "v1" }),
      })
    );
    const using = within(venueGroup()).getByRole("button", { name: "Using Studio 5 as the venue" });
    expect(using).toHaveAttribute("aria-pressed", "true");
    expect(using).toHaveTextContent("Using this one");
    expect(within(venueGroup()).getByText("Using existing venue: Studio 5")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("status")
        .some((node) => /Using existing venue/.test(node.textContent ?? ""))
    ).toBe(true);

    await user.click(using);
    expect(onReview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        venue: expect.objectContaining({ decision: "pending", selected_id: null }),
      })
    );
  });

  it("searches for another existing record and selects it explicitly", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    client.searchEntityMatches.mockResolvedValue([hall]);
    render(<Harness onReview={onReview} />);

    await user.type(
      within(venueGroup()).getByLabelText("Find a different existing venue"),
      "Rhythm"
    );
    await user.click(within(venueGroup()).getByRole("button", { name: "Search venues" }));

    expect(client.searchEntityMatches).toHaveBeenCalledWith("venue", "Rhythm");
    const pick = await within(venueGroup()).findByRole("button", {
      name: "Use Rhythm Hall as the venue",
    });
    expect(onReview).not.toHaveBeenCalled();

    await user.click(pick);
    const last = latest(onReview) as EntityReview;
    expect(last.venue).toMatchObject({ decision: "existing", selected_id: "v2" });
    expect(last.venue!.matches.map((match) => match.id)).toEqual(["v2", "v1"]);
  });

  it("says when a search finds nothing, and when it fails", async () => {
    const user = userEvent.setup();
    client.searchEntityMatches.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("boom"));
    render(<Harness />);
    const group = within(venueGroup());
    await user.type(group.getByLabelText("Find a different existing venue"), "Nowhere");
    await user.click(group.getByRole("button", { name: "Search venues" }));
    expect(await group.findByText("No existing venues found for “Nowhere”.")).toBeInTheDocument();

    await user.click(group.getByRole("button", { name: "Search venues" }));
    expect(
      await group.findByText("Search is unavailable right now. Try again.")
    ).toBeInTheDocument();
  });

  it("runs the search on Enter without submitting the surrounding form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    client.searchEntityMatches.mockResolvedValue([]);
    render(
      <form onSubmit={submit}>
        <EntityReviewSection review={baseReview()} onChange={() => undefined} />
        <button type="submit">Submit event</button>
      </form>
    );
    const input = within(venueGroup()).getByLabelText("Find a different existing venue");
    await user.type(input, "Rhythm{Enter}");
    expect(client.searchEntityMatches).toHaveBeenCalledWith("venue", "Rhythm");
    expect(submit).not.toHaveBeenCalled();

    await user.type(within(venueGroup()).getByLabelText("City"), "{Enter}");
    expect(submit).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation to create a new record, worded for the mode", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const { unmount } = render(<Harness onReview={onReview} mode="authorized" />);
    await user.click(within(venueGroup()).getByRole("button", { name: "Add as new venue" }));
    expect(latest(onReview).venue).toMatchObject({
      decision: "new",
      selected_id: null,
    });
    expect(
      within(venueGroup()).getByRole("button", { name: "Adding as new venue" })
    ).toHaveAttribute("aria-pressed", "true");
    unmount();

    render(<Harness mode="public" />);
    expect(
      within(venueGroup()).getByRole("button", { name: "Suggest as new venue" })
    ).toBeInTheDocument();
    expect(screen.getByText(/A moderator confirms anything new/)).toBeInTheDocument();
  });

  it("marks decisions as the person's own, and as moderator-confirmed only in authorized mode", async () => {
    const user = userEvent.setup();
    const authorized = vi.fn();
    const first = render(<Harness onReview={authorized} mode="authorized" />);
    await user.click(
      within(venueGroup()).getByRole("button", { name: "Use Studio 5 as the venue" })
    );
    expect(latest(authorized).venue).toMatchObject({
      decision: "existing",
      explicit: true,
      moderator_confirmed: true,
    });
    first.unmount();

    const publicCalls = vi.fn();
    render(<Harness onReview={publicCalls} mode="public" />);
    await user.click(
      within(venueGroup()).getByRole("button", { name: "Use Studio 5 as the venue" })
    );
    expect(latest(publicCalls).venue).toMatchObject({ explicit: true });
    expect(latest(publicCalls).venue).not.toHaveProperty("moderator_confirmed");
  });

  it("will not create a new record the server could not tell apart, and says what to add", async () => {
    const user = userEvent.setup();
    const review = baseReview();
    review.instructors[0].candidate = { name: "Ana Rivera" };
    const onReview = vi.fn();
    render(<Harness initial={review} onReview={onReview} mode="authorized" />);
    const ana = within(screen.getByRole("group", { name: /^Instructor: Ana Rivera/ }));
    const create = ana.getByRole("button", { name: "Add as new instructor" });
    expect(create).toBeDisabled();
    expect(ana.getByText(/include a website or Instagram/)).toBeInTheDocument();

    await user.type(ana.getByLabelText("Instagram"), "@anarivera");
    expect(ana.getByRole("button", { name: "Add as new instructor" })).toBeEnabled();
    expect(ana.queryByText(/include a website or Instagram/)).not.toBeInTheDocument();
  });

  it("does not gate a public suggestion on a creation signal", () => {
    const review = baseReview();
    review.instructors[0].candidate = { name: "Ana Rivera" };
    render(<Harness initial={review} mode="public" />);
    const ana = within(screen.getByRole("group", { name: /^Instructor: Ana Rivera/ }));
    expect(ana.getByRole("button", { name: "Suggest as new instructor" })).toBeEnabled();
  });
  it("removes a candidate, keeps it visible, and can undo", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness onReview={onReview} />);
    await user.click(within(venueGroup()).getByRole("button", { name: "Remove venue" }));

    expect(latest(onReview).venue.decision).toBe("removed");
    expect(within(venueGroup()).getByText("Not using this venue")).toBeInTheDocument();

    await user.click(within(venueGroup()).getByRole("button", { name: "Undo remove venue" }));
    expect(latest(onReview).venue.decision).toBe("pending");
    expect(within(venueGroup()).getByRole("button", { name: "Remove venue" })).toBeInTheDocument();
  });

  it("keeps a removed instructor in the list as a removal so positions never shift", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness onReview={onReview} />);
    const ana = within(screen.getByRole("group", { name: /^Instructor: Ana Rivera/ }));
    await user.click(ana.getByRole("button", { name: "Remove instructor" }));
    const last = latest(onReview) as EntityReview;
    expect(last.instructors).toHaveLength(1);
    expect(last.instructors[0].decision).toBe("removed");
  });

  it("adds an instructor the flyer missed by name, then checks it against existing records", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    client.reconcileEntities.mockResolvedValue({
      venue: null,
      organizer: null,
      instructors: [
        {
          candidate: { name: "Luis Ortega" },
          state: "POSSIBLE MATCH",
          matches: [hall],
          decision: "pending",
          selected_id: null,
        },
      ],
      school: null,
    });
    render(<Harness onReview={onReview} />);
    const add = screen.getByRole("button", { name: "Add instructor" });
    expect(add).toBeDisabled();

    await user.type(screen.getByLabelText("Add instructor by name"), "  Luis Ortega ");
    await user.click(add);

    expect(onReview.mock.calls[0][0].instructors).toHaveLength(2);
    expect(onReview.mock.calls[0][0].instructors[1]).toMatchObject({
      candidate: { name: "Luis Ortega" },
      state: "NEEDS REVIEW",
      decision: "pending",
    });
    expect(client.reconcileEntities).toHaveBeenCalledWith({
      venue: null,
      organizer: null,
      instructors: [{ name: "Luis Ortega" }],
      school: null,
    });
    await waitFor(() => expect(latest(onReview).instructors[1].state).toBe("POSSIBLE MATCH"));
    expect(screen.getByLabelText("Add instructor by name")).toHaveValue("");
  });

  it("lets a person add a candidate where the flyer had none, and never invents an empty one", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    client.reconcileEntities.mockRejectedValue(new Error("offline"));
    render(<Harness onReview={onReview} />);
    expect(screen.getByRole("button", { name: "Add organizer" })).toBeDisabled();
    expect(onReview).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Add organizer by name"), "Salsa Nights{Enter}");
    expect(onReview.mock.calls[0][0].organizer).toMatchObject({
      candidate: { name: "Salsa Nights" },
      decision: "pending",
    });
    // The check failing leaves the candidate reviewable by hand.
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t check this organizer");
  });

  it("never commits a blank name and restores the last name when the field is left empty", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness onReview={onReview} />);
    const name = within(venueGroup()).getByLabelText("Name");
    await user.clear(name);
    expect(onReview).not.toHaveBeenCalled();
    expect(within(venueGroup()).getByText(/A name is required/)).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.tab();
    expect(name).toHaveValue("studio five");
    expect(onReview).not.toHaveBeenCalled();
  });
});

describe("editing a candidate", () => {
  const matched = (): EntityReview => ({
    ...baseReview(),
    venue: {
      candidate: { name: "Studio 5", address: "5 Main St", city: "Boston", phone: "555-0100" },
      state: "MATCHED",
      matches: [studio],
      decision: "existing",
      selected_id: "v1",
    },
  });

  it("invalidates the earlier match and decision and asks for a re-check", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness initial={matched()} onReview={onReview} />);
    expect(within(venueGroup()).getByText("Matched")).toBeInTheDocument();

    const address = within(venueGroup()).getByLabelText("Address");
    await user.clear(address);
    await user.type(address, "77 Other Rd");

    const last = latest(onReview) as EntityReview;
    expect(last.venue).toMatchObject({
      state: "NEEDS REVIEW",
      decision: "pending",
      selected_id: null,
      matches: [],
    });
    expect(last.venue!.candidate.address).toBe("77 Other Rd");
    expect(within(venueGroup()).getByText("Needs review")).toBeInTheDocument();
    expect(within(venueGroup()).queryByText(/Matched/)).not.toBeInTheDocument();
    expect(within(venueGroup()).getByRole("button", { name: "Check for matches" })).toBeEnabled();
  });

  it("keeps the decision when only a contact field changes", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<Harness initial={matched()} onReview={onReview} />);
    await user.type(within(venueGroup()).getByLabelText("Phone"), "9");
    expect(latest(onReview).venue).toMatchObject({
      state: "MATCHED",
      decision: "existing",
      selected_id: "v1",
    });
  });

  it("re-reconciles the edited candidate and applies the fresh verdict", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    client.reconcileEntities.mockResolvedValue({
      venue: {
        candidate: { name: "server copy" },
        state: "MATCHED",
        matches: [hall],
        decision: "existing",
        selected_id: "v2",
      },
      organizer: null,
      instructors: [],
      school: null,
    });
    render(<Harness initial={matched()} onReview={onReview} />);
    const name = within(venueGroup()).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Rhythm Hall");
    await user.click(within(venueGroup()).getByRole("button", { name: "Check for matches" }));

    expect(client.reconcileEntities).toHaveBeenCalledWith({
      venue: expect.objectContaining({ name: "Rhythm Hall" }),
      organizer: null,
      instructors: [],
      school: null,
    });
    await waitFor(() =>
      expect(latest(onReview).venue).toMatchObject({
        state: "MATCHED",
        decision: "existing",
        selected_id: "v2",
        candidate: { name: "Rhythm Hall" },
      })
    );
  });

  it("drops a re-check result when the person kept editing while it ran", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const { promise, resolve } = Promise.withResolvers<EntityReview>();
    client.reconcileEntities.mockReturnValue(promise);
    render(<Harness initial={matched()} onReview={onReview} />);
    const name = within(venueGroup()).getByLabelText("Name");
    await user.type(name, " Annex");
    await user.click(within(venueGroup()).getByRole("button", { name: "Check for matches" }));
    await user.type(name, "!");
    const before = onReview.mock.calls.length;

    resolve({
      venue: {
        candidate: { name: "stale" },
        state: "MATCHED",
        matches: [hall],
        decision: "existing",
        selected_id: "v2",
      },
      organizer: null,
      instructors: [],
      school: null,
    });
    await new Promise((done) => setTimeout(done, 0));

    expect(onReview.mock.calls.length).toBe(before);
    expect(latest(onReview).venue.decision).toBe("pending");
  });

  it("explains a failed re-check and leaves the review untouched", async () => {
    const user = userEvent.setup();
    client.reconcileEntities.mockRejectedValue(new Error("down"));
    render(<Harness initial={matched()} />);
    await user.type(within(venueGroup()).getByLabelText("Name"), "x");
    await user.click(within(venueGroup()).getByRole("button", { name: "Check for matches" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t check this venue against existing records."
    );
  });
});
