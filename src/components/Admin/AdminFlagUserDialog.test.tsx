import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminFlagUserDialog from "./AdminFlagUserDialog";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";

type Props = ComponentProps<typeof AdminFlagUserDialog>;

const user = {
  id: "user-1",
  username: "jane",
  role: "user",
} as unknown as AdminUserRow;

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    user,
    isBusy: false,
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<AdminFlagUserDialog {...props} />), props };
}

describe("AdminFlagUserDialog", () => {
  it("starts focus on the reason select", () => {
    renderDialog();
    expect(screen.getByLabelText("Reason")).toHaveFocus();
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-flag-user-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-flag-user-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("traps Tab from the last focusable back to the first, and Shift+Tab back", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const select = screen.getByLabelText("Reason");
    const flagButton = screen.getByRole("button", { name: "Flag account" });

    flagButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(select).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(flagButton).toHaveFocus();
  });

  it("returns focus to the opener when it closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "Flag";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("submits reason combined with trimmed notes verbatim", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Spam" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), {
      target: { value: "  repeated posting  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Flag account" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("Spam — repeated posting");
  });
});
