import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminRejectFounderDialog from "./AdminRejectFounderDialog";

type Props = ComponentProps<typeof AdminRejectFounderDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    requestId: "req-1",
    isBusy: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isOpen: true,
    ...overrides,
  };
  return { ...render(<AdminRejectFounderDialog {...props} />), props };
}

describe("AdminRejectFounderDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts focus on the reason select, not the destructive Reject control", () => {
    renderDialog();
    expect(screen.getByLabelText(/Reason/)).toHaveFocus();
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-reject-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-reject-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("traps Tab from the last focusable back to the first, and Shift+Tab back", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const select = screen.getByLabelText(/Reason/);
    const rejectButton = screen.getByRole("button", { name: "Reject Request" });

    rejectButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(select).toHaveFocus();

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

  it("submits request id, reason code, and message verbatim, preferring message over the internal note", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, requestId: "req-9" });

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "unable_to_verify_organizer" },
    });
    fireEvent.change(screen.getByLabelText("Message to applicant (optional)"), {
      target: { value: "We could not verify your organization." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
      "req-9",
      "unable_to_verify_organizer",
      "We could not verify your organization."
    );
  });
});
