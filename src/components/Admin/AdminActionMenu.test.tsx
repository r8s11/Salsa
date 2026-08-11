import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminActionMenu, { type ActionMenuItem } from "./AdminActionMenu";

function makeItems(onSelect: (id: string) => void): ActionMenuItem[] {
  return [
    { id: "edit", label: "Edit", onSelect: () => onSelect("edit") },
    { id: "duplicate", label: "Duplicate", onSelect: () => onSelect("duplicate") },
    { id: "delete", label: "Delete", tone: "danger", separatorBefore: true, onSelect: () => onSelect("delete") },
  ];
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
});
