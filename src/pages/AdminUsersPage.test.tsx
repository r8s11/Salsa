import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AdminUserRow } from "../features/admin/model/usersQuery";
import AdminUsersPage from "./AdminUsersPage";

const { useAdminUsers } = vi.hoisted(() => ({ useAdminUsers: vi.fn() }));

vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers }));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ user: { id: "self-1" }, isAdmin: true }),
}));

const selfAdmin: AdminUserRow = {
  kind: "profile",
  id: "self-1",
  user_id: "self-1",
  email: "roosevelt@salsa.test",
  display_name: "Roosevelt Segura",
  username: "rooseveltsegura",
  avatar_url: null,
  role: "admin",
  status: "active",
  status_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_active_at: "2026-08-01T00:00:00.000Z",
  contributions: 12,
  pending_count: 2,
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  approved_count: 0,
};

const organizer: AdminUserRow = {
  kind: "profile",
  id: "organizer-1",
  user_id: "organizer-1",
  email: "maria@salsa.test",
  display_name: "Maria Santos",
  username: "mariasalsa",
  avatar_url: "https://example.com/maria.jpg",
  role: "organizer",
  status: "active",
  status_reason: null,
  created_at: "2026-02-01T00:00:00.000Z",
  last_active_at: "2026-07-01T00:00:00.000Z",
  contributions: 3,
  pending_count: 0,
  email_confirmed_at: "2026-02-01T00:00:00.000Z",
  approved_count: 0,
};

const flaggedUser: AdminUserRow = {
  kind: "profile",
  id: "flagged-1",
  user_id: "flagged-1",
  email: "flagged@salsa.test",
  display_name: "Flagged Person",
  username: null,
  avatar_url: null,
  role: "user",
  status: "flagged",
  status_reason: "Spam",
  created_at: "2026-03-01T00:00:00.000Z",
  last_active_at: "2026-07-01T00:00:00.000Z",
  contributions: 0,
  pending_count: 0,
  email_confirmed_at: "2026-03-01T00:00:00.000Z",
  approved_count: 0,
};

const suspendedUser: AdminUserRow = {
  kind: "profile",
  id: "suspended-1",
  user_id: "suspended-1",
  email: "suspended@salsa.test",
  display_name: "Suspended Person",
  username: null,
  avatar_url: null,
  role: "user",
  status: "suspended",
  status_reason: null,
  created_at: "2026-04-01T00:00:00.000Z",
  last_active_at: "2026-06-01T00:00:00.000Z",
  contributions: 1,
  pending_count: 0,
  email_confirmed_at: "2026-04-01T00:00:00.000Z",
  approved_count: 0,
};

const bannedUser: AdminUserRow = {
  kind: "profile",
  id: "banned-1",
  user_id: "banned-1",
  email: "banned@salsa.test",
  display_name: "Banned Person",
  username: null,
  avatar_url: null,
  role: "user",
  status: "banned",
  status_reason: "Harassment",
  created_at: "2026-05-01T00:00:00.000Z",
  last_active_at: "2026-05-15T00:00:00.000Z",
  contributions: 0,
  pending_count: 0,
  email_confirmed_at: "2026-05-01T00:00:00.000Z",
  approved_count: 0,
};

const guest: AdminUserRow = {
  kind: "guest",
  id: "guest:vince@salsa.test",
  user_id: null,
  email: "vince@salsa.test",
  display_name: "Vince Guest",
  username: null,
  avatar_url: null,
  role: null,
  status: "active",
  status_reason: null,
  created_at: "2026-06-01T00:00:00.000Z",
  last_active_at: "2026-06-05T00:00:00.000Z",
  contributions: 1,
  pending_count: 1,
  email_confirmed_at: null,
  approved_count: 0,
};

const users: AdminUserRow[] = [selfAdmin, organizer, flaggedUser, suspendedUser, bannedUser, guest];

const defaultState = {
  users,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  setRole: vi.fn(),
  settingRoleId: null,
  roleErrorId: null,
  roleError: null,
  setStatus: vi.fn(),
  settingStatusId: null,
  statusErrorId: null,
  statusError: null,
  createUser: vi.fn(),
  isCreating: false,
  createError: null,
};

function renderPage() {
  return render(<AdminUsersPage />, { wrapper: MemoryRouter });
}

function renderAt(path: string) {
  return render(<AdminUsersPage />, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  });
}

function usersTable() {
  return screen.getByRole("table");
}

function desktopRowFor(name: string) {
  return within(
    within(usersTable()).getByText(name).closest("tr") as HTMLElement
  );
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  const row = desktopRowFor(name);
  await user.click(row.getByRole("button", { name: `Actions for ${name}` }));
  return screen.getByRole("menu");
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState });
  });

  it("a registered row shows display name, handle, email, role badge, status badge, and contributions", () => {
    renderPage();
    const row = desktopRowFor("Maria Santos");

    expect(row.getByText("@mariasalsa")).toBeInTheDocument();
    expect(row.getByText("maria@salsa.test")).toBeInTheDocument();
    expect(row.getByText("Organizer")).toBeInTheDocument();
    expect(row.getByText("Active")).toBeInTheDocument();
    expect(row.getByText("3 contributions")).toBeInTheDocument();
  });

  it("a guest row shows Guest Submitter-equivalent identity, no public profile, no role badge, and a single-item menu", async () => {
    const user = userEvent.setup();
    renderPage();
    const table = usersTable();

    expect(within(table).getByText("Vince Guest")).toBeInTheDocument();
    expect(within(table).getByText("No public profile")).toBeInTheDocument();

    const menu = await openRowMenu(user, "Vince Guest");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("View Submissions");
  });

  it("?view=flagged renders only the flagged row; ?view=banned with no banned fixture renders the empty state", () => {
    renderAt("/admin/users?view=flagged");
    let table = usersTable();
    expect(within(table).getByText("Flagged Person")).toBeInTheDocument();
    expect(within(table).queryByText("Maria Santos")).not.toBeInTheDocument();

    vi.mocked(useAdminUsers).mockReturnValue({
      ...defaultState,
      users: users.filter((u) => u.status !== "banned"),
    });
    renderAt("/admin/users?view=banned");
    expect(screen.getByText("No banned accounts.")).toBeInTheDocument();
  });

  it("searching an email substring narrows to that one row", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "maria@salsa.test");

    await vi.waitFor(() => {
      const table = usersTable();
      expect(within(table).getByText("Maria Santos")).toBeInTheDocument();
      expect(within(table).queryByText("Roosevelt Segura")).not.toBeInTheDocument();
    });
  });

  it("Change Role shows moderator consequence copy and confirms with the selected role", async () => {
    const user = userEvent.setup();
    const setRole = vi.fn();
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState, setRole });
    renderPage();

    const menu = await openRowMenu(user, "Maria Santos");
    await user.click(within(menu).getByRole("menuitem", { name: "Change Role" }));

    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("New role"), "moderator");
    expect(
      within(dialog).getByText(
        "Moderators can review, edit, approve, and reject user-submitted events. They cannot approve Organizer requests."
      )
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Change Role" }));
    expect(setRole).toHaveBeenCalledWith(
      { id: "organizer-1", role: "moderator" },
      expect.anything()
    );
  });

  it("Ban with an empty reason does not call setStatus; typing a reason and confirming does", async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn();
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState, setStatus });
    renderPage();

    const menu = await openRowMenu(user, "Maria Santos");
    await user.click(within(menu).getByRole("menuitem", { name: "Ban" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Ban User" }));
    expect(setStatus).not.toHaveBeenCalled();
    expect(screen.getByText("A reason is required.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Reason"), "Repeated abuse");
    await user.click(within(dialog).getByRole("button", { name: "Ban User" }));

    expect(setStatus).toHaveBeenCalledWith(
      { id: "organizer-1", status: "banned", reason: "Repeated abuse" },
      expect.anything()
    );
  });

  it("the self row's menu contains neither Change Role, Suspend, nor Ban", async () => {
    const user = userEvent.setup();
    renderPage();

    const menu = await openRowMenu(user, "Roosevelt Segura");
    expect(within(menu).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Suspend" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Ban" })).not.toBeInTheDocument();
  });

  it("with exactly one admin in the directory, that admin's menu contains no Change Role", async () => {
    const user = userEvent.setup();
    vi.mocked(useAdminUsers).mockReturnValue({
      ...defaultState,
      users: users.map((u) => (u.id === "self-1" ? { ...u, user_id: "someone-else" } : u)),
    });
    renderPage();

    const menu = await openRowMenu(user, "Roosevelt Segura");
    expect(within(menu).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
  });

  it("statusErrorId set renders the row error while every other row stays rendered", () => {
    vi.mocked(useAdminUsers).mockReturnValue({
      ...defaultState,
      statusErrorId: "organizer-1",
      statusError: "This is the only active Admin account.",
    });
    renderPage();

    expect(
      screen.getAllByText("Action failed: This is the only active Admin account.").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Roosevelt Segura").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Flagged Person").length).toBeGreaterThan(0);
  });

  it("Add User button opens a dialog that creates a new user with the chosen role", async () => {
    const user = userEvent.setup();
    const createUser = vi.fn();
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState, createUser });
    renderPage();

    await user.click(screen.getByRole("button", { name: "Add User" }));

    const dialog = screen.getByRole("dialog", { name: "Add User" });
    await user.type(
      within(dialog).getByLabelText("Email"),
      "newmod@salsa.test"
    );
    await user.selectOptions(within(dialog).getByLabelText("Role"), "moderator");
    await user.click(within(dialog).getByRole("button", { name: "Create account" }));

    expect(createUser).toHaveBeenCalledWith(
      { email: "newmod@salsa.test", display_name: undefined, role: "moderator" },
      expect.anything()
    );
  });

  it("shows the temporary password once the account is created", async () => {
    const user = userEvent.setup();
    const createUser = vi.fn((_params, options) =>
      options.onSuccess({
        id: "new-user-1",
        email: "newmod@salsa.test",
        display_name: null,
        username: null,
        role: "moderator",
        status: "active",
        created_at: "2026-08-20T00:00:00Z",
        temp_password: "Tmp123456789abc",
      })
    );
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState, createUser });
    renderPage();

    await user.click(screen.getByRole("button", { name: "Add User" }));
    const dialog = screen.getByRole("dialog", { name: "Add User" });
    await user.type(within(dialog).getByLabelText("Email"), "newmod@salsa.test");
    await user.click(within(dialog).getByRole("button", { name: "Create account" }));

    const result = screen.getByRole("dialog", { name: "Account created" });
    expect(within(result).getByText("Tmp123456789abc")).toBeInTheDocument();
    expect(within(result).getByText("newmod@salsa.test")).toBeInTheDocument();

    await user.click(within(result).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Account created" })).not.toBeInTheDocument();
  });
});
