import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityCandidate, EntityCandidates } from "./entityReview";
import { reconcileEntities, searchEntityMatches } from "./entityReviewClient";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));

function candidate(name: string, extra: Partial<EntityCandidate> = {}): EntityCandidate {
  return {
    name,
    address: null,
    city: null,
    state_region: null,
    country: null,
    website: null,
    instagram: null,
    email: null,
    phone: null,
    organization: null,
    ...extra,
  };
}

const EMPTY: EntityCandidates = { venue: null, organizer: null, instructors: [], school: null };

function reviewItem(name: string, overrides: Record<string, unknown> = {}) {
  return {
    candidate: candidate(name),
    state: "NEW",
    matches: [],
    decision: "pending",
    selected_id: null,
    ...overrides,
  };
}

describe("reconcileEntities", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed review and keeps the text the user sent, not server echoes", async () => {
    rpc.mockResolvedValue({
      data: {
        venue: reviewItem("HAVANA CLUB (server-cased)", {
          state: "MATCHED",
          decision: "existing",
          selected_id: "11111111-1111-4111-8111-111111111111",
          matches: [{ id: "11111111-1111-4111-8111-111111111111", name: "Havana Club" }],
        }),
        organizer: null,
        instructors: [reviewItem("Ana R.")],
        school: null,
      },
      error: null,
    });

    const review = await reconcileEntities({
      venue: candidate("Havana Club"),
      organizer: null,
      instructors: [candidate("Ana Rivera")],
      school: null,
    });

    expect(review.venue?.candidate.name).toBe("Havana Club");
    expect(review.venue?.decision).toBe("existing");
    expect(review.venue?.selected_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(review.instructors[0].candidate.name).toBe("Ana Rivera");
  });

  it("never leaks raw server errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "secret detail" } });
    const failure = await reconcileEntities({ ...EMPTY, school: candidate("Mambo Co") }).catch(
      (caught: unknown) => caught as Error
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain("secret detail");
  });
});

describe("searchEntityMatches", () => {
  beforeEach(() => vi.resetAllMocks());

  it("skips the round trip for queries that are too short and bounds long ones", async () => {
    await expect(searchEntityMatches("venue", " a ")).resolves.toEqual([]);
    await expect(searchEntityMatches("venue", "   ")).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: [], error: null });
    await searchEntityMatches("school", "x".repeat(500));
    expect(rpc.mock.calls[0][1].p_query).toHaveLength(120);
  });
});
