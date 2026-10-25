import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlyerPagerControls } from "./FlyerPager";
import { useFlyerPager } from "./useFlyerPager";

const FALLBACK = "/images/event-fallbacks/salsa.svg";

function Harness({ initial }: { initial: { key: string; flyers: string[] } }) {
  const [{ key, flyers }, setEvent] = useState(initial);
  const pager = useFlyerPager({
    flyers,
    fallbackUrl: FALLBACK,
    artKind: "flyer",
    resetKey: key,
  });
  return (
    <div tabIndex={0} data-testid="cover" onKeyDown={pager.onKeyDown}>
      <img src={pager.url} alt="" data-kind={pager.artKind} onError={pager.onImageError} />
      <FlyerPagerControls pager={pager} />
      <button onClick={() => setEvent({ key: "other", flyers: ["/z1.jpg", "/z2.jpg"] })}>
        switch event
      </button>
    </div>
  );
}

const three = { key: "e1", flyers: ["/a.jpg", "/b.jpg", "/c.jpg"] };
const src = () => document.querySelector("img")!.getAttribute("src");

describe("FlyerPager", () => {
  it("renders no controls for a single flyer and ignores arrow keys and load errors", () => {
    render(<Harness initial={{ key: "e1", flyers: ["/a.jpg"] }} />);
    expect(screen.queryByRole("group", { name: "Event flyers" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("cover"), { key: "ArrowRight" });
    fireEvent.error(document.querySelector("img")!);
    expect(src()).toBe("/a.jpg");
  });

  it("flips with next/previous, wrapping at both ends, and announces the position", () => {
    render(<Harness initial={three} />);
    const status = screen.getByText("Flyer 1 of 3");
    expect(status).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    expect(src()).toBe("/b.jpg");
    expect(screen.getByText("Flyer 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    expect(src()).toBe("/a.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Previous flyer" }));
    expect(src()).toBe("/c.jpg");
    expect(screen.getByText("Flyer 3 of 3")).toBeInTheDocument();
  });

  it("jumps to a flyer from its dot and marks the current one", () => {
    render(<Harness initial={three} />);
    fireEvent.click(screen.getByRole("button", { name: "Show flyer 3" }));
    expect(src()).toBe("/c.jpg");
    expect(screen.getByRole("button", { name: "Show flyer 3" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Show flyer 1" })).not.toHaveAttribute("aria-current");
  });

  it("flips with Left/Right arrows on the focused cover", () => {
    render(<Harness initial={three} />);
    const cover = screen.getByTestId("cover");
    fireEvent.keyDown(cover, { key: "ArrowRight" });
    expect(src()).toBe("/b.jpg");
    fireEvent.keyDown(cover, { key: "ArrowLeft" });
    fireEvent.keyDown(cover, { key: "ArrowLeft" });
    expect(src()).toBe("/c.jpg");
  });

  it("skips a flyer that fails to load and shrinks the count", () => {
    render(<Harness initial={three} />);
    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    expect(src()).toBe("/b.jpg");
    fireEvent.error(document.querySelector("img")!);
    expect(src()).toBe("/c.jpg");
    expect(screen.getByText("Flyer 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    expect(src()).toBe("/a.jpg");
  });

  it("drops the controls when only one flyer is left, and uses fallback art when none are", () => {
    render(<Harness initial={{ key: "e1", flyers: ["/a.jpg", "/b.jpg"] }} />);
    fireEvent.error(document.querySelector("img")!);
    expect(src()).toBe("/b.jpg");
    expect(screen.queryByRole("button", { name: "Next flyer" })).not.toBeInTheDocument();
    fireEvent.error(document.querySelector("img")!);
    expect(src()).toBe(FALLBACK);
    expect(document.querySelector("img")).toHaveAttribute("data-kind", "fallback");
  });

  it("returns to the first flyer when a different event is shown", () => {
    render(<Harness initial={three} />);
    fireEvent.click(screen.getByRole("button", { name: "Next flyer" }));
    fireEvent.click(screen.getByRole("button", { name: "switch event" }));
    expect(src()).toBe("/z1.jpg");
    expect(screen.getByText("Flyer 1 of 2")).toBeInTheDocument();
  });
});
