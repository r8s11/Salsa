import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUserForm from "./AdminUserForm";
import type { CreatedAccount } from "../../features/admin/api/profilesRepo";

const emailInviteCreated: CreatedAccount = {
  delivery: "email_invitation",
  id: "user-1",
  email: "maria@salsa.test",
  role: "organizer",
  display_name: "Maria Santos",
  status: "active",
  created_at: "2026-08-20T00:00:00Z",
};

const tempPasswordCreated: CreatedAccount = {
  delivery: "temporary_password",
  id: "user-2",
  email: "newmod@salsa.test",
  display_name: null,
  username: null,
  role: "moderator",
  status: "active",
  created_at: "2026-08-20T00:00:00Z",
  temp_password: "Tmp123456789abc",
};

describe("AdminUserForm", () => {
  it("does not show a delivery control for the default non-Organizer role", () => {
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();
  });

  it("shows a delivery control defaulted to Email invitation when role is Organizer", async () => {
    const user = userEvent.setup();
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    await user.selectOptions(screen.getByLabelText("Role"), "organizer");

    const emailRadio = screen.getByRole("radio", { name: "Email invitation" });
    const tempPasswordRadio = screen.getByRole("radio", { name: "Temporary password" });
    expect(emailRadio).toBeChecked();
    expect(tempPasswordRadio).not.toBeChecked();
  });

  it("removes the delivery control when switching away from Organizer", async () => {
    const user = userEvent.setup();
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    await user.selectOptions(screen.getByLabelText("Role"), "organizer");
    expect(screen.getByText("Delivery")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role"), "moderator");
    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();
  });

  it("submits Organizer with delivery: email_invitation by default", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText("Email"), "maria@salsa.test");
    await user.selectOptions(screen.getByLabelText("Role"), "organizer");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "maria@salsa.test",
      display_name: undefined,
      role: "organizer",
      delivery: "email_invitation",
    });
  });

  it("submits Organizer with delivery: temporary_password when the fallback is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText("Email"), "maria@salsa.test");
    await user.selectOptions(screen.getByLabelText("Role"), "organizer");
    await user.click(screen.getByRole("radio", { name: "Temporary password" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "maria@salsa.test",
      display_name: undefined,
      role: "organizer",
      delivery: "temporary_password",
    });
  });

  it("submits non-Organizer roles without a delivery field, preserving prior behavior", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AdminUserForm isBusy={false} error={null} created={null} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText("Email"), "newmod@salsa.test");
    await user.selectOptions(screen.getByLabelText("Role"), "moderator");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "newmod@salsa.test",
      display_name: undefined,
      role: "moderator",
    });
  });

  it("email invitation success never renders a temporary password", () => {
    render(
      <AdminUserForm
        isBusy={false}
        error={null}
        created={emailInviteCreated}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Account created" });
    expect(within(dialog).getByText(/invitation was sent/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/temporary password/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Copy credentials")).not.toBeInTheDocument();
  });

  it("temporary-password success renders exactly as before", () => {
    render(
      <AdminUserForm
        isBusy={false}
        error={null}
        created={tempPasswordCreated}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Account created" });
    expect(within(dialog).getByText("Tmp123456789abc")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy credentials" })).toBeInTheDocument();
  });

  it("renders a safe error message as an alert without exposing service internals", () => {
    render(
      <AdminUserForm
        isBusy={false}
        error="An account already exists for this email"
        created={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("An account already exists for this email");
  });
});
