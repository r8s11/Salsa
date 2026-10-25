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
  it("publishes social identity and restores prior route metadata", () => {
    const previous = document.createElement("meta");
    previous.setAttribute("property", "og:title");
    previous.content = "Previous page";
    document.head.append(previous);
    const { unmount } = renderHook(() =>
      useDocumentMeta({
        title: "Boston Salsa School",
        description: "Classes and approved dance events.",
        canonical: "https://www.salsasegura.com/s/boston-salsa-school",
        image: "https://www.salsasegura.com/school.jpg",
      })
    );
    expect(previous.content).toContain("Boston Salsa School");
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content", "https://www.salsasegura.com/s/boston-salsa-school"
    );
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute(
      "content", "https://www.salsasegura.com/school.jpg"
    );
    expect(document.querySelector('meta[name="twitter:description"]')).toHaveAttribute(
      "content", "Classes and approved dance events."
    );
    unmount();
    expect(previous.content).toBe("Previous page");
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    previous.remove();
  });
});
