import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_EVENT_FLYER_BYTES,
  removeEventFlyer,
  uploadEventFlyer,
  validateEventFlyer,
} from "./eventFlyers";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabaseURL: "https://project.supabase.co",
  supabase: {
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: mocks.getPublicUrl,
      }),
    },
  },
}));

const pngFile = new File(["png"], "flyer.png", { type: "image/png" });

describe("event flyer storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported and oversized flyer files", () => {
    expect(validateEventFlyer(new File(["gif"], "flyer.gif", { type: "image/gif" }))).toMatch(
      /JPEG, PNG, or WebP/i
    );
    expect(
      validateEventFlyer(
        new File([new Uint8Array(MAX_EVENT_FLYER_BYTES + 1)], "flyer.png", {
          type: "image/png",
        })
      )
    ).toMatch(/5 MB/i);
  });

  it("uploads a supported flyer and returns its public URL", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          "https://project.supabase.co/storage/v1/object/public/event-flyers/user-1/event-1/flyer.png",
      },
    });

    await expect(
      uploadEventFlyer({ file: pngFile, ownerId: "user-1", eventId: "event-1" })
    ).resolves.toEqual({
      path: expect.stringMatching(/^user-1\/event-1\/.+\.png$/),
      url: "https://project.supabase.co/storage/v1/object/public/event-flyers/user-1/event-1/flyer.png",
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/event-1\/.+\.png$/),
      pngFile,
      { contentType: "image/png", upsert: false }
    );
  });

  it("does not remove a lookalike bucket URL from another origin", async () => {
    await removeEventFlyer(
      "https://example.com/storage/v1/object/public/event-flyers/user-1/event-1/flyer.jpg"
    );

    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
