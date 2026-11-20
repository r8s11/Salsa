import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AssignOrganizerMemberDialog from "./AssignOrganizerMemberDialog";

const { mutate, fetchAdminEntityDirectory, assignState } = vi.hoisted(() => ({
  mutate: vi.fn(),
  fetchAdminEntityDirectory: vi.fn(),
  assignState: { isPending: false, error: null as Error | null },
}));
vi.mock("../../entities/api/entitiesRepo", () => ({ fetchAdminEntityDirectory }));
vi.mock("../../hooks/useOrganizerAccess", () => ({
  useAssignOrganizerMember: () => ({ mutate, reset: vi.fn(), ...assignState }),
}));
vi.mock("../../hooks/useAdminUsers", () => ({
  useAdminUsers: () => ({
    isLoading: false,
    error: null,
    users: [
      {
        kind: "profile",
        id: "u2",
        user_id: "u2",
        email: "ana@example.test",
        display_name: "Ana",
        username: null,
        status: "active",
        role: "user",
      },
      {
        kind: "profile",
        id: "u3",
        user_id: "u3",
        email: "banned@example.test",
        display_name: "Ana Banned",
        username: null,
        status: "banned",
        role: "user",
      },
    ],
  }),
}));
vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));

function renderDialog(props: Partial<ComponentProps<typeof AssignOrganizerMemberDialog>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AssignOrganizerMemberDialog onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mutate.mockReset();
  fetchAdminEntityDirectory.mockReset().mockResolvedValue([]);
  assignState.isPending = false;
  assignState.error = null;
});

describe("AssignOrganizerMemberDialog", () => {
  it("assigns a fixed user to a searched organizer after review", async () => {
    fetchAdminEntityDirectory.mockResolvedValue([
      { id: "o1", name: "Rob — Boston", city: "boston", status: "active" },
    ]);
    renderDialog({ user: { id: "u1", name: "Rob" } });
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    await user.type(screen.getByLabelText("Search active organizers"), "rob");
    await user.click(await screen.findByRole("radio", { name: /Rob — Boston/ }));
    await user.click(screen.getByRole("radio", { name: /Manager/ }));
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByRole("heading", { name: "Review access" })).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
    expect(mutate).toHaveBeenCalledWith(
      { userId: "u1", role: "manager", organizerId: "o1" },
      expect.any(Object)
    );
    expect(fetchAdminEntityDirectory).toHaveBeenCalledWith({
      kind: "organizer",
      query: "rob",
      status: "active",
    });
  });

  it("creates a new organizer in the same call and defaults to Owner", async () => {
    renderDialog({ user: { id: "u1", name: "Rob" } });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search active organizers"), "zzz");
    await user.click(screen.getByRole("button", { name: "Not listed? Create a new organizer" }));
    expect(screen.getByLabelText("New organizer name")).toHaveValue("zzz");
    await user.clear(screen.getByLabelText("New organizer name"));
    await user.type(screen.getByLabelText("New organizer name"), "Brand New");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
    expect(mutate).toHaveBeenCalledWith(
      { userId: "u1", role: "owner", newOrganizer: { name: "Brand New" } },
      expect.any(Object)
    );
  });

  it("picks an active user for a fixed organizer", async () => {
    renderDialog({ organizer: { id: "o1", name: "Rob — Boston" } });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search users by name, username or email"), "ana");
    expect(screen.queryByText("Ana Banned")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Ana/ }));
    await user.click(screen.getByRole("radio", { name: /Editor/ }));
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
    expect(mutate).toHaveBeenCalledWith(
      { userId: "u2", role: "editor", organizerId: "o1" },
      expect.any(Object)
    );
  });

  it("shows the resulting access after success", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onSuccess({
        organizer_id: "o1",
        user_id: "u1",
        member_role: "owner",
        outcome: "created",
        previous_role: null,
        organizer_created: false,
        user_platform_role: "user",
      })
    );
    renderDialog({
      user: { id: "u1", name: "Rob" },
      organizer: { id: "o1", name: "Rob — Boston" },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Access updated" })).toBeInTheDocument()
    );
    expect(screen.getByRole("status")).toHaveTextContent("added to the team as Owner");
    expect(screen.getByText(/Their platform role is user/)).toBeInTheDocument();
  });

  it("shows actionable errors on the review step", async () => {
    assignState.error = new Error(
      "Organizer is archived and cannot receive new team members. Activate it first."
    );
    renderDialog({ user: { id: "u1", name: "Rob" }, organizer: { id: "o1", name: "X" } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Activate it first.");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderDialog({ user: { id: "u1", name: "Rob" }, organizer: { id: "o1", name: "X" }, onClose });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
