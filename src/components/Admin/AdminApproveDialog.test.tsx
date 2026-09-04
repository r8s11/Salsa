import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminApproveDialog from "./AdminApproveDialog";

type Props = ComponentProps<typeof AdminApproveDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    requestId: "req-1",
    isBusy: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isOpen: true,
    ...overrides,
  };
  return { ...render(<AdminApproveDialog {...props} />), props };
}

describe("AdminApproveDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts focus on the Approve control (non-destructive action)", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Approve Request" })).toHaveFocus();
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-approve-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-approve-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("traps Tab from the last focusable back to the first, and Shift+Tab back", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const approveButton = screen.getByRole("button", { name: "Approve Request" });

    approveButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(approveButton).toHaveFocus();
  });

  it("returns focus to the opener when it closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "Approve";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("submits the request id verbatim", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, requestId: "req-42" });

    fireEvent.click(screen.getByRole("button", { name: "Approve Request" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("req-42");
  });
});
