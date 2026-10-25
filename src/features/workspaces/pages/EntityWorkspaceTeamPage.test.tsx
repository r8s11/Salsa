import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntityWorkspaceTeamPage from "./EntityWorkspaceTeamPage";
import { member, renderWorkspacePage, schoolWorkspace } from "./workspaceTestKit";
import type { EntityWorkspace } from "../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

function serve(workspace: EntityWorkspace, overrides: Record<string, RpcResult> = {}) {
  rpc.mockImplementation((fn: string) =>
    Promise.resolve(overrides[fn] ?? (fn === "entity_workspace" ? { data: workspace, error: null } : { data: null, error: null }))
  );
}

function renderTeam() {
  return renderWorkspacePage(
    <EntityWorkspaceTeamPage kind="school" />,
    "/host/schools/school-1/team",
    "/host/schools/:id/team"
  );
}

function memberCalls() {
  return rpc.mock.calls.filter(([name]) => name === "entity_member_update");
}

beforeEach(() => {
  rpc.mockReset();
});

describe("EntityWorkspaceTeamPage", () => {
  it("lists each member's name, email and role", async () => {
    serve(
      schoolWorkspace({
        members: [member("owner", { display_name: "Ana Rivera" }), member("editor")],
      })
    );
    renderTeam();

    const list = await screen.findByRole("list", { name: "Team members" });
    expect(within(list).getByText("Ana Rivera")).toBeInTheDocument();
    expect(within(list).getByText("owner@example.com")).toBeInTheDocument();
    expect(within(list).getByLabelText("Role for Ana Rivera")).toHaveValue("owner");
    expect(within(list).getByLabelText("Role for editor@example.com")).toHaveValue("editor");
  });

  it("surfaces the last-owner refusal verbatim when demoting the only owner", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ members: [member("owner")] }), {
      entity_member_update: {
        data: null,
        error: { message: "A listing must keep at least one owner.", code: "P0001" },
      },
    });
    renderTeam();

    await user.selectOptions(await screen.findByLabelText("Role for owner@example.com"), "Manager");

    expect(await screen.findByRole("alert")).toHaveTextContent("A listing must keep at least one owner.");
    expect(screen.getByLabelText("Role for owner@example.com")).toHaveValue("owner");
  });

  it("changes a member's role", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ members: [member("owner"), member("editor")] }));
    renderTeam();

    await user.selectOptions(await screen.findByLabelText("Role for editor@example.com"), "Manager");

    await waitFor(() => expect(memberCalls()).toHaveLength(1));
    expect(memberCalls()[0][1]).toEqual({
      p_kind: "school",
      p_id: "school-1",
      p_user_id: "user-editor",
      p_role: "manager",
      p_remove: false,
    });
  });

  it("removes a member only after confirmation, and shows a refusal inside the dialog", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ members: [member("owner"), member("manager")] }), {
      entity_member_update: { data: null, error: { message: "A listing must keep at least one owner.", code: "P0001" } },
    });
    renderTeam();

    await user.click(await screen.findByRole("button", { name: "Remove manager@example.com" }));
    expect(memberCalls()).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove from team" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("A listing must keep at least one owner.");
    expect(memberCalls()[0][1]).toMatchObject({ p_user_id: "user-manager", p_remove: true });
  });

  it("adds a person by email with the chosen role", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderTeam();

    const form = await screen.findByRole("form", { name: "Add team member" });
    await user.type(within(form).getByLabelText("Email"), "newperson@example.com");
    await user.selectOptions(within(form).getByLabelText("Role"), "Editor");
    await user.click(within(form).getByRole("button", { name: "Add to team" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("entity_member_add", {
      p_kind: "school",
      p_id: "school-1",
      p_email: "newperson@example.com",
      p_role: "editor",
    }));
    expect(await within(form).findByText(/newperson@example\.com is now editor of this listing\./)).toBeInTheDocument();
  });

  it("surfaces an unknown email verbatim", async () => {
    const user = userEvent.setup();
    const message = "No Salsa Segura account uses that email. Ask them to sign up first.";
    serve(schoolWorkspace(), { entity_member_add: { data: null, error: { message, code: "P0002" } } });
    renderTeam();

    const form = await screen.findByRole("form", { name: "Add team member" });
    await user.type(within(form).getByLabelText("Email"), "ghost@example.com");
    await user.click(within(form).getByRole("button", { name: "Add to team" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(message);
  });

  it("rejects a malformed email without calling the database", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderTeam();

    const form = await screen.findByRole("form", { name: "Add team member" });
    await user.type(within(form).getByLabelText("Email"), "not-an-email");
    await user.click(within(form).getByRole("button", { name: "Add to team" }));

    expect(await within(form).findByText(/Enter the email address/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("entity_member_add", expect.anything());
  });

  it("shows a manager the team read-only", async () => {
    serve(schoolWorkspace({ role: "manager", members: [member("owner"), member("manager")] }));
    renderTeam();

    expect(await screen.findByText("Only owners can add people, change roles or remove them.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add team member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Role for/)).not.toBeInTheDocument();
  });
});
