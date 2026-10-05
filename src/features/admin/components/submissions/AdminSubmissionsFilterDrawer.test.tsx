import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSubmissionsFilterDrawer from "./AdminSubmissionsFilterDrawer";

describe("AdminSubmissionsFilterDrawer", () => {
  it("contains focus only while open and restores the opener after each close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = {
      submissions: [],
      filters: { status: null, submitter_name: null },
      onFiltersChange: vi.fn(),
      onClose,
    };
    const view = (open: boolean) => (
      <>
        <button>Open filters</button>
        <AdminSubmissionsFilterDrawer {...props} open={open} />
      </>
    );
    const overflow = document.body.style.overflow;
    const { rerender } = render(view(false));
    const opener = screen.getByRole("button", { name: "Open filters" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe(overflow);

    for (let cycle = 0; cycle < 2; cycle += 1) {
      opener.focus();
      rerender(view(true));
      const dialog = screen.getByRole("dialog", { name: "Filter submissions" });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      expect(document.body.style.overflow).toBe("hidden");
      expect(opener).toHaveAttribute("inert");
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(cycle + 1);
      rerender(view(false));
      expect(opener).toHaveFocus();
      expect(opener).not.toHaveAttribute("inert");
      expect(document.body.style.overflow).toBe(overflow);
    }
  });
});
