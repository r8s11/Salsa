import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentMeta } from "./useDocumentMeta";

afterEach(() => {
  cleanup();
});

describe("useDocumentMeta", () => {
  it("sets and restores robots directives for unpublished routes", () => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "index, follow";
    document.head.append(robots);

    const { unmount } = renderHook(() =>
      useDocumentMeta({
        title: "Lessons",
        description: "Lessons listing coming soon.",
        robots: "noindex, follow",
      })
    );

    expect(robots.content).toBe("noindex, follow");
    unmount();
    expect(robots.content).toBe("index, follow");
    robots.remove();
  });
});
