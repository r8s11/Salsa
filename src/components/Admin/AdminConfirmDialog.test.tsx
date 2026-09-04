import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import AdminConfirmDialog from "./AdminConfirmDialog";

type Props = ComponentProps<typeof AdminConfirmDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: "Delete “Salsa On2”?",
    body: "This permanently deletes the term.",
    confirmLabel: "Delete Term",
    isBusy: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  return { ...render(<AdminConfirmDialog {...props} />), props };
}

describe("AdminConfirmDialog", () => {
  it("starts danger confirmations on Cancel", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps a danger confirmation on Cancel even when a caller asks for Confirm", () => {
    renderDialog({ initialFocus: "confirm" });

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("starts neutral confirmations on Confirm and honours an explicit Cancel override", () => {
    const neutral = renderDialog({
      tone: "neutral",
      title: "Publish this term?",
      confirmLabel: "Publish Term",
    });
    expect(screen.getByRole("button", { name: "Publish Term" })).toHaveFocus();
    neutral.unmount();

    renderDialog({
      tone: "neutral",
      confirmLabel: "Publish Term",
      initialFocus: "cancel",
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("describes itself with its body copy", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "This permanently deletes the term."
    );
  });

  it("dismisses on Escape and backdrop click while idle", () => {
    const onCancel = vi.fn();
    const { unmount } = renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = vi.fn();
    renderDialog({ onCancel: second });
    fireEvent.click(document.querySelector(".admin-confirm-dialog__overlay")!);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed by Escape, backdrop, or Cancel while busy", () => {
    const onCancel = vi.fn();
    renderDialog({ isBusy: true, onCancel, error: "Delete failed. Try again." });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(document.querySelector(".admin-confirm-dialog__overlay")!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("keeps the mutation error visible while the dialog stays mounted", () => {
    renderDialog({ isBusy: true, error: "Delete failed. Try again." });

    expect(screen.getByRole("alert")).toHaveTextContent("Delete failed. Try again.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders a caller-provided busy label instead of the generic one", () => {
    renderDialog({ isBusy: true, busyLabel: "Deleting…" });

    expect(screen.getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Working…" })).not.toBeInTheDocument();
  });

  it("falls back to the generic busy label for existing callers", () => {
    renderDialog({ isBusy: true });

    expect(screen.getByRole("button", { name: "Working…" })).toBeInTheDocument();
  });

  it("traps Tab across every interactive descendant, not just buttons", () => {
    renderDialog({ reasonField: { label: "Reason", required: true } });

    const dialog = screen.getByRole("dialog");
    // Inject the remaining interactive kinds the trap must include.
    const extras = document.createElement("div");
    extras.innerHTML =
      '<input aria-label="note" /><select aria-label="pick"><option>a</option></select><a href="/docs">Docs</a>';
    dialog.insertBefore(extras, dialog.firstChild);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Delete Term" });
    const link = screen.getByRole("link", { name: "Docs" });

    // Forward from the last node wraps to the first (the injected input).
    confirm.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByLabelText("note")).toHaveFocus();

    // Shift+Tab from the first node wraps to the last (Confirm).
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    // Interior nodes are reachable and not hijacked by the trap.
    for (const node of [screen.getByLabelText("pick"), link, screen.getByLabelText("Reason"), cancel]) {
      node.focus();
      fireEvent.keyDown(dialog, { key: "Tab" });
      expect(node).toHaveFocus();
    }
  });

  it("returns focus to the opener when it closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "Delete";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("confirms once and requires a reason when the caller asks for one", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, reasonField: { label: "Reason", required: true } });

    fireEvent.click(screen.getByRole("button", { name: "Delete Term" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A reason is required.");

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Duplicate term" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete Term" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("Duplicate term");
  });
});
