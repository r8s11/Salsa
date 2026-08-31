import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrganizerAccessError,
  createOrganizerEvent,
  fetchMyOrganizers,
  fetchOrganizerEvents,
  updateOrganizerEvent,
} from "./organizerAccessRepo";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));

vi.mock("../../events/api/eventsRepo", () => ({
  projectEventTaxonomy: (rows: unknown) => rows ?? [],
}));

type Result = { data: unknown; error: { message: string } | null };

function chain(result: Result) {
  const terminal = Promise.resolve(result);
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(() => terminal),
    maybeSingle: vi.fn(() => terminal),
  };
  return builder;
}

const memberRow = {
  member_role: "owner",
  status: "active",
  organizers: { id: "org-1", name: "Havana Club", slug: "havana-club", status: "active" },
};

describe("fetchMyOrganizers", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("projects active memberships without accepting a user id", async () => {
    mocks.from.mockReturnValue(
      chain({ data: [memberRow, { ...memberRow, organizers: null }], error: null })
    );

    const result = await fetchMyOrganizers();

    expect(result).toEqual([
      {
        organizerId: "org-1",
        organizerName: "Havana Club",
        organizerSlug: "havana-club",
        organizerStatus: "active",
        memberRole: "owner",
      },
    ]);
    expect(mocks.from).toHaveBeenCalledWith("organizer_members");
  });

  it("surfaces query errors", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: "rls denied" } }));
    await expect(fetchMyOrganizers()).rejects.toThrow("rls denied");
  });
});

describe("fetchOrganizerEvents", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("returns the organizer's events after a membership check", async () => {
    const eventRow = { id: "evt-1", title: "Salsa Night" };
    mocks.from
      .mockReturnValueOnce(chain({ data: memberRow, error: null }))
      .mockReturnValueOnce(chain({ data: [eventRow], error: null }));

    const result = await fetchOrganizerEvents("org-1");

    expect(result).toEqual([eventRow]);
    expect(mocks.from).toHaveBeenNthCalledWith(1, "organizer_members");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "events");
  });

  it("denies organizers without an active membership and never queries events", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: null }));

    await expect(fetchOrganizerEvents("org-other")).rejects.toBeInstanceOf(OrganizerAccessError);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("organizer_members");
  });
});

describe("updateOrganizerEvent", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("routes through the organizer_update_event RPC with server-side authorization", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await updateOrganizerEvent("evt-1", { title: "New title" });

    expect(mocks.rpc).toHaveBeenCalledWith("organizer_update_event", {
      p_event_id: "evt-1",
      p_payload: { title: "New title" },
    });
  });

  it("propagates RPC denials (cross-organizer, editor, anonymous)", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "active owner or manager membership required" },
    });

    await expect(updateOrganizerEvent("evt-2", { title: "x" })).rejects.toThrow(
      "active owner or manager membership required"
    );
  });
});

describe("createOrganizerEvent", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("sends the selected organizer and publish intent to the authorized RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: "evt-new", error: null });

    await expect(
      createOrganizerEvent("org-1", { title: "Salsa Night", event_type: "social", dance_styles: [] }, true)
    ).resolves.toBe("evt-new");
    expect(mocks.rpc).toHaveBeenCalledWith("organizer_create_event", {
      p_organizer_id: "org-1",
      p_payload: { title: "Salsa Night", event_type: "social", dance_styles: [] },
      p_publish: true,
    });
  });
});
