import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import RubberSegment from "./RubberSegment";

const RECTS: Record<string, Partial<DOMRect>> = {
  "rubber-segment__thumb": { left: 0, right: 200, top: 0, bottom: 60, width: 200, height: 60 },
  "slot second": { left: 104, right: 196, top: 8, bottom: 52, width: 92, height: 44 },
};

function renderSegment(value: string | undefined, fitHeight = false) {
  return render(
    <RubberSegment items={["a", "b"]} value={value} itemSelector=".slot" fitHeight={fitHeight}>
      <button className="slot">A</button>
      <button className="slot second">B</button>
    </RubberSegment>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("RubberSegment", () => {
  it("clips the thumb to the selected slot, height included when fitting height", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, ...RECTS[this.className] } as DOMRect;
    });

    const fitted = renderSegment("b", true).container.querySelector<HTMLElement>(".rubber-segment__thumb")!;
    await waitFor(() => expect(fitted.style.clipPath).toBe("inset(8px 4px 8px 104px round 8px)"));

    const fullHeight = renderSegment("b").container.querySelector<HTMLElement>(".rubber-segment__thumb")!;
    await waitFor(() => expect(fullHeight.style.clipPath).toBe("inset(0px 4px 0px 104px round 8px)"));
  });

  it("shows no thumb when the selected value is not one of the slots", () => {
    const { container } = renderSegment("elsewhere");
    expect(container.querySelector(".rubber-segment__thumb")).toBeNull();
    expect(container.querySelectorAll(".slot")).toHaveLength(2);
  });
});
