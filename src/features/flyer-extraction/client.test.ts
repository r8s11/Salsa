import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractEventFromFlyer } from "./client";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  supabase: { functions: { invoke } },
}));
describe("extractEventFromFlyer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a validated extraction response", async () => {
    invoke.mockResolvedValue({ data: { extraction: { title: " Salsa Night " } }, error: null });
    await expect(extractEventFromFlyer("https://project.supabase.co/storage/v1/object/public/event-flyers/user/submission-id/flyer.png"))
      .resolves.toEqual(expect.objectContaining({ title: "Salsa Night" }));
    expect(invoke).toHaveBeenCalledWith("extract-flyer", expect.objectContaining({
      body: { imageUrl: expect.any(String) },
    }));
  });

  it("translates function failures without exposing provider details", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Provider secret leaked" } });
    await expect(extractEventFromFlyer("https://project.supabase.co/flyer.png"))
      .rejects.toThrow("We couldn't read this flyer. Please try again.");
  });

  it("rejects malformed function responses", async () => {
    invoke.mockResolvedValue({ data: { extraction: { title: 42 } }, error: null });
    await expect(extractEventFromFlyer("https://project.supabase.co/flyer.png"))
      .rejects.toThrow("We couldn't read this flyer. Please try again.");
  });
});
