import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useProfileMedia } from "./useProfileMedia";

const { updateOwnProfile, uploadAvatarFile, uploadCoverFile, removeAvatarFile, removeCoverFile } =
  vi.hoisted(() => ({
    updateOwnProfile: vi.fn(),
    uploadAvatarFile: vi.fn(),
    uploadCoverFile: vi.fn(),
    removeAvatarFile: vi.fn(),
    removeCoverFile: vi.fn(),
  }));

vi.mock("../api/accountRepo", () => ({ updateOwnProfile }));
vi.mock("../api/profileMedia", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/profileMedia")>();
  return {
    ...original,
    uploadAvatarFile,
    uploadCoverFile,
    removeAvatarFile,
    removeCoverFile,
  };
});

const pngFile = new File(["png"], "photo.png", { type: "image/png" });

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed the own-profile cache so merge behavior is observable.
  client.setQueryData(["profile", "mine", "user-1"], {
    id: "user-1",
    display_name: "Maria",
    avatar_url: null,
    cover_url: null,
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useProfileMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upload patches only avatar_url and merges it into the profile cache", async () => {
    uploadAvatarFile.mockResolvedValue("https://cdn.test/profile-media/user-1/avatar.webp?v=1");
    updateOwnProfile.mockResolvedValue({ id: "user-1", avatar_url: "x" });

    const { result } = renderHook(() => useProfileMedia("user-1"), { wrapper });

    let url!: string;
    await act(async () => {
      url = await result.current.avatar.upload(pngFile);
    });

    expect(uploadAvatarFile).toHaveBeenCalledWith(pngFile, "user-1");
    expect(updateOwnProfile).toHaveBeenCalledWith("user-1", {
      avatar_url: "https://cdn.test/profile-media/user-1/avatar.webp?v=1",
    });
    expect(url).toContain("avatar.webp");
    expect(result.current.avatar.isBusy).toBe(false);
    expect(result.current.avatar.error).toBeNull();
  });

  it("remove clears cover_url even when the storage object is already gone", async () => {
    removeCoverFile.mockRejectedValue(new Error("Not found"));
    updateOwnProfile.mockResolvedValue({ id: "user-1" });

    const { result } = renderHook(() => useProfileMedia("user-1"), { wrapper });

    await act(async () => {
      await result.current.cover.remove();
    });

    expect(updateOwnProfile).toHaveBeenCalledWith("user-1", { cover_url: null });
    expect(result.current.cover.error).toBeNull();
  });

  it("surfaces readable errors when upload validation fails", async () => {
    uploadCoverFile.mockRejectedValue(new Error("Choose a JPEG, PNG, or WebP image."));

    const { result } = renderHook(() => useProfileMedia("user-1"), { wrapper });

    await act(async () => {
      await expect(result.current.cover.upload(pngFile)).rejects.toThrow(/JPEG, PNG/);
    });

    await waitFor(() => expect(result.current.cover.error).toMatch(/JPEG, PNG/));
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("surfaces a save error when the profile update fails after upload", async () => {
    uploadAvatarFile.mockResolvedValue("https://cdn.test/x.webp?v=1");
    updateOwnProfile.mockRejectedValue(new Error("RLS denied"));

    const { result } = renderHook(() => useProfileMedia("user-1"), { wrapper });

    await act(async () => {
      await expect(result.current.avatar.upload(pngFile)).rejects.toThrow();
    });

    expect(result.current.avatar.error).toBeTruthy();
  });
});
