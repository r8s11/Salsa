import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminRejectOrganizerDialog from "./AdminRejectOrganizerDialog";

type Props = ComponentProps<typeof AdminRejectOrganizerDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    isBusy: false,
    error: null,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  return { ...render(<AdminRejectOrganizerDialog {...props} />), props };
}

describe("AdminRejectOrganizerDialog", () => {
  it("starts focus on Cancel, not the destructive Reject control", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-reject-organizer-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-reject-organizer-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("traps Tab from the last focusable back to the first, and Shift+Tab back", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", { name: "Close" });
    const rejectButton = screen.getByRole("button", { name: "Reject Request" });

    rejectButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(rejectButton).toHaveFocus();
  });

  it("returns focus to the opener when it closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "Reject";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("submits the reject reason, optional applicant message, and internal note verbatim", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "duplicate_organizer_brand" },
    });
    fireEvent.change(screen.getByLabelText("Message to Applicant (Optional)"), {
      target: { value: "Please reapply later." },
    });
    fireEvent.change(screen.getByLabelText("Internal Admin Note (Optional)"), {
      target: { value: "Seen this brand before." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      reason_code: "duplicate_organizer_brand",
      reason_message: "Please reapply later.",
      internal_note: "Seen this brand before.",
    });
  });
});
