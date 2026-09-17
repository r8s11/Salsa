import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PROFILE_MEDIA_BYTES,
  avatarPath,
  computeCoverCrop,
  coverPath,
  mediaPathFor,
  parseProfileMediaPath,
  profileMediaErrorMessage,
  removeAvatarFile,
  removeProfileMediaByPath,
  uploadProfileMedia,
  validateProfileImage,
  withCacheBust,
} from "./profileMedia";

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

const pngFile = new File(["png"], "photo.png", { type: "image/png" });

describe("profile media storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses stable per-user object paths (overwrite on replace)", () => {
    expect(avatarPath("user-1")).toBe("user-1/avatar.webp");
    expect(coverPath("user-1")).toBe("user-1/cover.webp");
    expect(mediaPathFor("user-1", "avatar")).toBe("user-1/avatar.webp");
    expect(mediaPathFor("user-1", "cover")).toBe("user-1/cover.webp");
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateProfileImage(new File(["gif"], "a.gif", { type: "image/gif" }))).toMatch(
      /JPEG, PNG, or WebP/i
    );
    expect(
      validateProfileImage(
        new File([new Uint8Array(MAX_PROFILE_MEDIA_BYTES + 1)], "a.png", {
          type: "image/png",
        })
      )
    ).toMatch(/5 MB/i);
    expect(validateProfileImage(pngFile)).toBeNull();
  });

  it("center-crops without stretching (cover geometry)", () => {
    // Wide source into square: full height kept, sides cropped.
    expect(computeCoverCrop(1600, 600, 512, 512)).toEqual({
      sx: 500,
      sy: 0,
      sw: 600,
      sh: 600,
    });
    // Tall source into 1600x600: full width kept, top/bottom cropped.
    expect(computeCoverCrop(600, 1600, 1600, 600)).toEqual({
      sx: 0,
      sy: 687.5,
      sw: 600,
      sh: 225,
    });
    // Exact match: no crop.
    expect(computeCoverCrop(512, 512, 512, 512)).toEqual({ sx: 0, sy: 0, sw: 512, sh: 512 });
  });

  it("uploads with upsert and returns a cache-busted public URL", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/profile-media/user-1/avatar.webp" },
    });

    const result = await uploadProfileMedia({
      blob: new Blob(["webp"], { type: "image/webp" }),
      ownerId: "user-1",
      kind: "avatar",
    });

    expect(result.path).toBe("user-1/avatar.webp");
    expect(result.url).toMatch(/avatar\.webp\?v=\d+/);
    expect(mocks.upload).toHaveBeenCalledWith("user-1/avatar.webp", expect.any(Blob), {
      contentType: "image/webp",
      upsert: true,
    });
  });

  it("propagates storage upload errors", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "row-level security" } });
    await expect(
      uploadProfileMedia({ blob: new Blob(["x"]), ownerId: "user-1", kind: "cover" })
    ).rejects.toThrow("row-level security");
  });

  it("appends a cache-busting version without stacking params", () => {
    expect(withCacheBust("https://cdn.test/a.webp", 123)).toBe("https://cdn.test/a.webp?v=123");
    expect(withCacheBust("https://cdn.test/a.webp?v=1", 2)).toBe(
      "https://cdn.test/a.webp?v=1&v=2"
    );
  });

  it("removes only exact stable avatar/cover paths", async () => {
    mocks.remove.mockResolvedValue({ error: null });

    await removeAvatarFile("user-1");
    expect(mocks.remove).toHaveBeenCalledWith(["user-1/avatar.webp"]);

    await removeProfileMediaByPath("../evil.webp");
    await removeProfileMediaByPath("/abs/avatar.webp");
    await removeProfileMediaByPath("user-1/gallery/extra.webp");
    await removeProfileMediaByPath("user-1/avatar.png");
    await removeProfileMediaByPath(null);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("parses only same-origin profile-media URLs (query stripped)", () => {
    expect(
      parseProfileMediaPath(
        "https://project.supabase.co/storage/v1/object/public/profile-media/user-1/avatar.webp?v=123"
      )
    ).toBe("user-1/avatar.webp");
    expect(
      parseProfileMediaPath(
        "https://example.com/storage/v1/object/public/profile-media/user-1/avatar.webp"
      )
    ).toBeNull();
    expect(
      parseProfileMediaPath(
        "https://project.supabase.co/storage/v1/object/public/event-flyers/user-1/x/y.jpg"
      )
    ).toBeNull();
    expect(parseProfileMediaPath("not a url")).toBeNull();
  });

  it("maps failures to readable messages without internals", () => {
    expect(profileMediaErrorMessage(new Error("row-level security policy"))).toMatch(
      /permission/i
    );
    expect(profileMediaErrorMessage(new Error("file too large"))).toMatch(/5 MB/);
    expect(profileMediaErrorMessage(new Error("JWT xyz"))).toBe(
      "We couldn't save this photo. Try again."
    );
  });
});
