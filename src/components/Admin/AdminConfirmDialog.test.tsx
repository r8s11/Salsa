import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AdminConfirmDialog from "./AdminConfirmDialog";

describe("AdminConfirmDialog", () => {
  it("can focus Cancel first for externally reachable access changes", () => {
    render(
      <AdminConfirmDialog
        title="Disable public event suggestions?"
        body="Visitors will no longer be able to submit events."
        confirmLabel="Disable public suggestions"
        isBusy={false}
        initialFocus="cancel"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps keyboard focus within its actions", () => {
    render(
      <AdminConfirmDialog
        title="Disable public event suggestions?"
        body="Visitors will no longer be able to submit events."
        confirmLabel="Disable public suggestions"
        isBusy={false}
        initialFocus="cancel"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Disable public suggestions" });
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });

    expect(confirm).toHaveFocus();
  });
});
