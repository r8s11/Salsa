import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminRejectSubmissionDialog from "./AdminRejectSubmissionDialog";

describe("AdminRejectSubmissionDialog", () => {
  it("calls onConfirm with dialog values", () => {
    const onConfirm = vi.fn();
    render(
      <AdminRejectSubmissionDialog
        submissionId="s1"
        isBusy={false}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Message to submitter/i }), {
      target: { value: "Sorry." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reject/i }));

    expect(onConfirm).toHaveBeenCalledWith("duplicate", "Sorry.", "");
  });

  it("exposes correct dialog semantics with role, aria-modal, aria-labelledby, and aria-describedby", () => {
    render(
      <AdminRejectSubmissionDialog
        submissionId="s1"
        submissionLabel="Summer Salsa Night"
        isBusy={false}
        onConfirm={vi.fn()}
        onCancel={() => {}}
      />
    );

    const dialog = screen.getByRole("dialog", { name: /reject.*summer salsa night/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const titleId = dialog.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    const title = document.getElementById(titleId!);
    expect(title).toHaveTextContent(/reject.*summer salsa night/i);

    const descriptionId = dialog.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const description = document.getElementById(descriptionId!);
    expect(description).toHaveTextContent(/submission will be removed from the review queue/i);
  });

  it("renders without a submission label using the submission ID", () => {
    render(
      <AdminRejectSubmissionDialog
        submissionId="s-42"
        isBusy={false}
        onConfirm={vi.fn()}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("dialog", { name: /reject submission s-42/i })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <AdminRejectSubmissionDialog
        submissionId="s1"
        isBusy={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("focuses the reason select on open", () => {
    render(
      <AdminRejectSubmissionDialog
        submissionId="s1"
        isBusy={false}
        onConfirm={vi.fn()}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("combobox", { name: /reason/i })).toHaveFocus();
  });
});
