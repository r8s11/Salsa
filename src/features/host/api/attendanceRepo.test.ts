import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { from } }));

import { checkInAttendee, reverseCheckIn, updateEventAttendee } from "./attendanceRepo";

/** Chainable PostgREST double resolving the response under test. */
function builder(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const name of ["insert", "update", "eq", "is", "select"]) {
    chain[name] = () => chain;
  }
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  return { chain };
}

describe("attendanceRepo mutations", () => {
  beforeEach(() => from.mockReset());

  it("reports a wrong-event or unauthorised attendee update instead of returning nothing", async () => {
    from.mockReturnValue(builder({ data: null, error: null }).chain);

    await expect(updateEventAttendee("evt-2", "att-1", { displayName: "X" })).rejects.toThrow(
      /not found on this event, or you do not have permission/
    );
  });

  it("reports a reversal that matched no row (already reversed or not permitted)", async () => {
    from.mockReturnValue(builder({ data: null, error: null }).chain);

    await expect(reverseCheckIn("evt-1", { checkInId: "ci-1" })).rejects.toThrow(
      /already be reversed, or you may not have permission/
    );
  });

  it("maps a second active check-in to a clear message", async () => {
    from.mockReturnValue(
      builder({ data: null, error: { code: "23505", message: "duplicate key value" } }).chain
    );

    await expect(checkInAttendee("evt-1", { attendeeId: "att-1" })).rejects.toThrow(
      "This attendee is already checked in."
    );
  });

  it("maps a row-level-security denial to a permission message", async () => {
    from.mockReturnValue(
      builder({
        data: null,
        error: { code: "42501", message: "new row violates row-level security policy" },
      }).chain
    );

    await expect(checkInAttendee("evt-1", { attendeeId: "att-1" })).rejects.toThrow(
      /do not have permission to check in this attendee/
    );
  });
});
