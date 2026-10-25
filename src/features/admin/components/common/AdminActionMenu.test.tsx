import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminActionMenu, { type ActionMenuItem } from "./AdminActionMenu";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeItems(onSelect: (id: string) => void): ActionMenuItem[] {
  return [
    { id: "edit", label: "Edit", onSelect: () => onSelect("edit") },
    { id: "duplicate", label: "Duplicate", onSelect: () => onSelect("duplicate") },
    {
      id: "delete",
      label: "Delete",
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onSelect("delete"),
    },
  ];
}

function rect({
  top,
  right,
  bottom,
  left,
  width,
  height,
}: {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    top,
    right,
    bottom,
    left,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe("AdminActionMenu", () => {
  it("Escape closes the menu and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu label="Actions for Salsa Night" items={makeItems(vi.fn())} />);

    const trigger = screen.getByRole("button", { name: "Actions for Salsa Night" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("ArrowDown wraps from the last item back to the first", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu label="Actions for Salsa Night" items={makeItems(vi.fn())} />);

    await user.click(screen.getByRole("button", { name: "Actions for Salsa Night" }));
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[0]).toHaveFocus();

    menuItems[2].focus();
    await user.keyboard("{ArrowDown}");
    expect(menuItems[0]).toHaveFocus();
  });

  it("selecting an item closes the menu and fires onSelect exactly once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AdminActionMenu label="Actions for Salsa Night" items={makeItems(onSelect)} />);

    await user.click(screen.getByRole("button", { name: "Actions for Salsa Night" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("duplicate");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("portals the panel outside an overflow container and positions it by the trigger", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1_000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.getAttribute("aria-label") === "Actions for Salsa Night") {
        return rect({ top: 100, right: 940, bottom: 144, left: 896, width: 44, height: 44 });
      }
      return rect({ top: 0, right: 180, bottom: 160, left: 0, width: 180, height: 160 });
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(160);

    const { container } = render(
      <div className="admin-shell">
        <div data-testid="overflow">
          <AdminActionMenu label="Actions for Salsa Night" items={makeItems(vi.fn())} />
        </div>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Actions for Salsa Night" }));
    const menu = screen.getByRole("menu");
    const overflow = screen.getByTestId("overflow");
    const shell = container.querySelector(".admin-shell");

    expect(overflow).not.toContainElement(menu);
    expect(shell).toContainElement(menu);
    expect(menu).toHaveStyle({ position: "fixed", top: "148px", left: "760px" });
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
  });
});
