import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminRoleChangeDialog from "./AdminRoleChangeDialog";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";

type Props = ComponentProps<typeof AdminRoleChangeDialog>;

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
  return { ...render(<AdminRoleChangeDialog {...props} />), props };
}

describe("AdminRoleChangeDialog", () => {
  it("starts focus on the role select", () => {
    renderDialog();
    expect(screen.getByLabelText("New role")).toHaveFocus();
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-role-change-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-role-change-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("traps Tab from the last focusable back to the first, and Shift+Tab back", () => {
    renderDialog({ user: { ...user, role: "moderator" } as AdminUserRow });
    const dialog = screen.getByRole("dialog");
    const select = screen.getByLabelText("New role");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    // Change Role starts disabled (selectedRole === currentRole); Cancel is the last focusable.
    cancelButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(select).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(cancelButton).toHaveFocus();
  });

  it("returns focus to the opener when it closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "Change role";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("submits the selected role verbatim", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "moderator" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Role" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("moderator");
  });
});
