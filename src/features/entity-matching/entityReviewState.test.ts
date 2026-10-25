import { describe, expect, it } from "vitest";
import { emptyEntityReview } from "./entityReview";
import type { EntityMatch, EntityReview, EntityReviewItem } from "./entityReview";
import {
  applyRecheck,
  chooseExisting,
  clearDecision,
  confirmNew,
  decisionSummary,
  editCandidateField,
  enrichExtractionWithReview,
  listReviewEntries,
  moderatorStartingReview,
  newReviewItem,
  readStoredEntityReview,
  removeItem,
  reviewFromCandidates,
  setReviewItem,
  suggestionsToPending,
  unresolvedCount,
  detachAutoVenueLink,
  hasCreationSignal,
  suppressAutoVenueLink,
} from "./entityReviewState";

const match = (id: string, name = "Studio 5"): EntityMatch => ({
  id,
  name,
  address: "5 Main St",
  city: "Boston",
  state_region: "MA",
  website: null,
  instagram: null,
});

const V1 = "11111111-1111-4111-8111-111111111111";
const V9 = "99999999-9999-4999-8999-999999999999";

const item = (overrides: Partial<EntityReviewItem> = {}): EntityReviewItem => ({
  candidate: { name: "Studio 5", address: "5 Main St", city: "Boston", phone: "555-0100" },
  state: "MATCHED",
  matches: [match(V1)],
  decision: "existing",
  selected_id: V1,
  ...overrides,
});

describe("editCandidateField", () => {
  it("invalidates the match, matches, and decision when an identifying field changes", () => {
    const edited = editCandidateField(item(), "address", "99 Other Rd");
    expect(edited.candidate.address).toBe("99 Other Rd");
    expect(edited).toMatchObject({
      state: "NEEDS REVIEW",
      matches: [],
      decision: "pending",
      selected_id: null,
    });
  });

  it("keeps the decision when only a contact field changes", () => {
    const edited = editCandidateField(item(), "phone", "555-0199");
    expect(edited.candidate.phone).toBe("555-0199");
    expect(edited.decision).toBe("existing");
    expect(edited.selected_id).toBe(V1);
    expect(edited.matches).toHaveLength(1);
  });

  it("returns the same object when the value did not change", () => {
    const original = item();
    expect(editCandidateField(original, "city", "Boston")).toBe(original);
  });

  it("stores cleared optional fields as null but never nulls the name", () => {
    expect(editCandidateField(item(), "phone", "").candidate.phone).toBeNull();
    expect(editCandidateField(item(), "name", "").candidate.name).toBe("");
  });
});

describe("decisions", () => {
  it("chooseExisting selects the match and adds a searched match to the list once", () => {
    const base = item({ matches: [], decision: "pending", selected_id: null, state: "NEW" });
    const chosen = chooseExisting(base, match(V9, "Other Studio"));
    expect(chosen.decision).toBe("existing");
    expect(chosen.selected_id).toBe(V9);
    expect(chosen.matches.map((entry) => entry.id)).toEqual([V9]);
    expect(chooseExisting(chosen, match(V9)).matches).toHaveLength(1);
  });

  it("confirmNew clears any selected id", () => {
    expect(confirmNew(item())).toMatchObject({ decision: "new", selected_id: null });
  });

  it("removeItem then clearDecision round-trips to undecided", () => {
    const removed = removeItem(item());
    expect(removed).toMatchObject({ decision: "removed", selected_id: null });
    expect(clearDecision(removed).decision).toBe("pending");
  });

  it("summarises each decision in words, not color", () => {
    expect(decisionSummary(item(), "venue")).toBe("Using existing venue: Studio 5");
    expect(decisionSummary(confirmNew(item()), "school")).toBe("Will be added as a new school");
    expect(decisionSummary(removeItem(item()), "instructor")).toBe("Not using this instructor");
    expect(decisionSummary(clearDecision(item()), "organizer")).toMatch(/Undecided/);
  });
});

describe("applyRecheck", () => {
  it("keeps the edited candidate and adopts the fresh verdict", () => {
    const edited = editCandidateField(item(), "name", "Studio Five");
    const fresh = item({
      candidate: { name: "studio five (server normalised)" },
      state: "POSSIBLE MATCH",
      decision: "pending",
      selected_id: null,
    });
    const merged = applyRecheck(edited, fresh);
    expect(merged.candidate.name).toBe("Studio Five");
    expect(merged.state).toBe("POSSIBLE MATCH");
    expect(merged.decision).toBe("pending");
  });

  it("treats a missing server item as new and undecided", () => {
    expect(applyRecheck(item(), null)).toMatchObject({
      state: "NEW",
      matches: [],
      decision: "pending",
    });
  });
});

describe("review shape helpers", () => {
  const review: EntityReview = {
    venue: item(),
    organizer: null,
    instructors: [item({ decision: "pending", selected_id: null }), item({ decision: "removed" })],
    school: item({ decision: "new", selected_id: null }),
  };

  it("lists entries in venue, organizer, instructors, school order with indices", () => {
    expect(listReviewEntries(review).map(({ slot, index }) => `${slot}:${index}`)).toEqual([
      "venue:0",
      "instructors:0",
      "instructors:1",
      "school:0",
    ]);
  });

  it("counts only pending decisions as unresolved", () => {
    expect(unresolvedCount(review)).toBe(1);
    expect(unresolvedCount(null)).toBe(0);
  });

  it("setReviewItem replaces and appends instructors without touching other slots", () => {
    const appended = setReviewItem(review, "instructors", 2, newReviewItem("  Luis "));
    expect(appended.instructors).toHaveLength(3);
    expect(appended.instructors[2].candidate.name).toBe("Luis");
    const replaced = setReviewItem(review, "instructors", 0, newReviewItem("Marta"));
    expect(replaced.instructors).toHaveLength(2);
    expect(replaced.instructors[0].candidate.name).toBe("Marta");
    expect(replaced.venue).toBe(review.venue);
  });

  it("a hand-added candidate starts undecided and needing a first check", () => {
    expect(newReviewItem("Studio 9")).toEqual({
      candidate: { name: "Studio 9" },
      state: "NEEDS REVIEW",
      matches: [],
      decision: "pending",
      selected_id: null,
    });
  });

  it("reviewFromCandidates leaves every candidate undecided and needing review", () => {
    const built = reviewFromCandidates({
      venue: { name: "Studio 5" },
      organizer: null,
      instructors: [{ name: "Ana" }, { name: "Luis" }],
      school: null,
    });
    expect(built.venue).toMatchObject({ state: "NEEDS REVIEW", decision: "pending" });
    expect(built.instructors).toHaveLength(2);
  });
});

describe("suggestionsToPending", () => {
  it("shows every submitter 'new' and 'existing' suggestion as undecided but keeps removals", () => {
    const review: EntityReview = {
      venue: confirmNew(item()),
      organizer: item(),
      instructors: [removeItem(item())],
      school: null,
    };
    const demoted = suggestionsToPending(review);
    expect(demoted.venue).toMatchObject({ decision: "pending", selected_id: null });
    expect(demoted.organizer).toMatchObject({ decision: "pending", selected_id: null });
    expect(demoted.organizer?.matches).toHaveLength(1);
    expect(demoted.instructors[0].decision).toBe("removed");
  });
});

describe("decision flags", () => {
  it("marks a chosen existing record explicit, and a moderator choice confirmed", () => {
    const base = item({ decision: "pending", selected_id: null });
    expect(chooseExisting(base, match(V1))).toMatchObject({ explicit: true });
    expect(chooseExisting(base, match(V1))).not.toHaveProperty("moderator_confirmed");
    expect(chooseExisting(base, match(V1), { moderator: true })).toMatchObject({
      explicit: true,
      moderator_confirmed: true,
    });
    expect(confirmNew(base, { moderator: true })).toMatchObject({ moderator_confirmed: true });
    expect(confirmNew(base)).not.toHaveProperty("moderator_confirmed");
  });

  it("drops the flags when a decision is cleared, removed, or invalidated by an edit", () => {
    const chosen = chooseExisting(item(), match(V1), { moderator: true });
    for (const next of [
      clearDecision(chosen),
      removeItem(chosen),
      editCandidateField(chosen, "address", "elsewhere"),
    ]) {
      expect(next).not.toHaveProperty("explicit");
      expect(next).not.toHaveProperty("moderator_confirmed");
    }
    expect(editCandidateField(chosen, "phone", "555-0123")).toMatchObject({ explicit: true });
  });
});

describe("hasCreationSignal", () => {
  it("needs an address, website or Instagram for venues and schools", () => {
    expect(hasCreationSignal("venue", { name: "A", city: "Boston" })).toBe(false);
    expect(hasCreationSignal("venue", { name: "A", address: "1 Main" })).toBe(true);
    expect(hasCreationSignal("school", { name: "A", instagram: "@a" })).toBe(true);
  });

  it("needs a website or Instagram for organizers and instructors; an address is not enough", () => {
    expect(hasCreationSignal("organizer", { name: "A", address: "1 Main", city: "Boston" })).toBe(
      false
    );
    expect(hasCreationSignal("instructor", { name: "A", website: "https://a.example" })).toBe(true);
    expect(hasCreationSignal("instructor", { name: "A", instagram: "  " })).toBe(false);
  });
});

describe("automatic venue links", () => {
  const auto = (): EntityReview => ({ ...emptyEntityReview(), venue: item() });

  it("suppresses an automatic link when the form already carries a different venue", () => {
    expect(suppressAutoVenueLink(auto(), { location: "My Own Hall" }).venue?.decision).toBe(
      "pending"
    );
    expect(suppressAutoVenueLink(auto(), { venue_id: "v-manual" }).venue?.decision).toBe("pending");
    expect(
      suppressAutoVenueLink(auto(), { location: "Studio 5", address: "99 Other Rd" }).venue
        ?.decision
    ).toBe("pending");
  });

  it("keeps the link when the form is empty or shows the candidate or the matched record", () => {
    expect(suppressAutoVenueLink(auto(), { location: "", address: "" })).toEqual(auto());
    expect(suppressAutoVenueLink(auto(), { location: " studio  5 " })).toEqual(auto());
    const renamed: EntityReview = {
      ...emptyEntityReview(),
      venue: item({ matches: [match(V1, "Canonical Club")] }),
    };
    expect(
      suppressAutoVenueLink(renamed, { location: "Canonical Club", address: "5 Main St" })
    ).toBe(renamed);
  });

  it("never suppresses a link the person chose explicitly", () => {
    const chosen: EntityReview = {
      ...emptyEntityReview(),
      venue: chooseExisting(item({ decision: "pending", selected_id: null }), match(V1)),
    };
    expect(suppressAutoVenueLink(chosen, { location: "My Own Hall" })).toBe(chosen);
  });

  it("detaches an automatic link when venue text, address, or venue id changes", () => {
    const previous = { location: "Studio 5", address: "", venue_id: "" };
    for (const change of [{ location: "Else" }, { address: "9 Elm" }, { venue_id: "v-1" }]) {
      const next = detachAutoVenueLink(previous, { ...previous, ...change, entity_review: auto() });
      expect(next.entity_review?.venue?.decision).toBe("pending");
    }
  });

  it("leaves the link alone for unrelated edits and for explicit choices", () => {
    const previous = { location: "Studio 5", address: "", venue_id: "" };
    const same = { ...previous, entity_review: auto() };
    expect(detachAutoVenueLink(previous, same)).toBe(same);
    const explicit = {
      ...previous,
      location: "Changed",
      entity_review: {
        ...emptyEntityReview(),
        venue: chooseExisting(item({ decision: "pending", selected_id: null }), match(V1)),
      },
    };
    expect(detachAutoVenueLink(previous, explicit)).toBe(explicit);
  });
});

describe("enrichExtractionWithReview", () => {
  const extraction = {
    title: "Social",
    venue_name: "studio 5",
    address: null,
    city: "boston",
  } as unknown as Parameters<typeof enrichExtractionWithReview>[0];

  it("replaces raw venue text with the explicitly selected existing record", () => {
    const enriched = enrichExtractionWithReview(extraction, {
      ...emptyEntityReview(),
      venue: item(),
    });
    expect(enriched).toMatchObject({
      venue_name: "Studio 5",
      address: "5 Main St",
      city: "Boston",
    });
  });

  it("leaves the extraction alone for undecided, new, or missing venues", () => {
    expect(enrichExtractionWithReview(extraction, null)).toBe(extraction);
    expect(
      enrichExtractionWithReview(extraction, { ...emptyEntityReview(), venue: confirmNew(item()) })
    ).toBe(extraction);
  });
});

describe("readStoredEntityReview", () => {
  it("returns null for absent, empty, or invalid stored data", () => {
    expect(readStoredEntityReview(null)).toBeNull();
    expect(readStoredEntityReview("nope")).toBeNull();
    expect(readStoredEntityReview({ instructors: [] })).toBeNull();
    expect(
      readStoredEntityReview({ venue: { candidate: { name: "Studio 5" }, state: "???" } })
    ).toBeNull();
  });

  it("round-trips a stored review", () => {
    const stored = { ...emptyEntityReview(), venue: item() };
    expect(readStoredEntityReview(JSON.parse(JSON.stringify(stored)))?.venue).toMatchObject({
      decision: "existing",
      selected_id: V1,
      candidate: { name: "Studio 5" },
    });
  });
});

describe("moderatorStartingReview", () => {
  const stored = (decision: "new" | "pending") =>
    JSON.parse(
      JSON.stringify({
        ...emptyEntityReview(),
        venue: item({ decision, matches: [], selected_id: null }),
      })
    );

  it("starts from the submitter's review with 'new' suggestions undecided", () => {
    const start = moderatorStartingReview(stored("new"), undefined);
    expect(start.demoted).toBe(true);
    expect(start.review?.venue?.decision).toBe("pending");
  });

  it("prefers the moderator's own earlier edits untouched", () => {
    const start = moderatorStartingReview(stored("pending"), stored("new"));
    expect(start.demoted).toBe(false);
    expect(start.review?.venue?.decision).toBe("new");
  });

  it("has no review when neither side stored one", () => {
    expect(moderatorStartingReview(undefined, null)).toEqual({ review: null, demoted: false });
  });
});
