import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntityWorkspaceProfilePage from "./EntityWorkspaceProfilePage";
import { renderWorkspacePage, schoolWorkspace } from "./workspaceTestKit";
import type { EntityWorkspace } from "../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

function serve(workspace: EntityWorkspace, overrides: Record<string, RpcResult> = {}) {
  rpc.mockImplementation((fn: string) =>
    Promise.resolve(overrides[fn] ?? (fn === "entity_workspace" ? { data: workspace, error: null } : { data: null, error: null }))
  );
}

function renderProfile(kind: "school" | "venue" | "instructor" = "school") {
  return renderWorkspacePage(
    <EntityWorkspaceProfilePage kind={kind} />,
    "/host/schools/school-1/profile",
    "/host/schools/:id/profile"
  );
}

beforeEach(() => {
  rpc.mockReset();
});

describe("EntityWorkspaceProfilePage", () => {
  it("shows the identity fields read-only with a note that Salsa Segura changes them", async () => {
    serve(schoolWorkspace());
    renderProfile();

    await screen.findByRole("form", { name: "Public profile" });
    expect(screen.getByText("Salsa Academy", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("boston", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/s/salsa-academy" })).toBeInTheDocument();
    expect(screen.getByText(/set by Salsa Segura/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
  });

  it("offers exactly the school's editable fields", async () => {
    serve(schoolWorkspace());
    renderProfile();

    await screen.findByRole("form", { name: "Public profile" });
    for (const label of ["Description", "Image link", "Website", "Instagram", "Phone", "Street address", "Postal code"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Address line 2")).not.toBeInTheDocument();
  });

  it("saves the edit, disabling the button while pending and stating success inline", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<RpcResult>();
    serve(schoolWorkspace());
    rpc.mockImplementation((fn: string) =>
      fn === "entity_profile_save"
        ? pending.promise
        : Promise.resolve({ data: schoolWorkspace(), error: null })
    );
    renderProfile();

    const save = await screen.findByRole("button", { name: "Save profile" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Website"), "https://academy.example");
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    pending.resolve({ data: null, error: null });

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    const call = rpc.mock.calls.find(([name]) => name === "entity_profile_save");
    expect(call?.[1]).toMatchObject({
      p_kind: "school",
      p_id: "school-1",
      p_payload: { website: "https://academy.example", description: "" },
    });
    // Identity fields never travel in the patch.
    expect(Object.keys(call?.[1].p_payload)).not.toEqual(expect.arrayContaining(["name"]));
  });

  it("states the server's refusal inline", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace(), {
      entity_profile_save: { data: null, error: { message: "Your role on this listing cannot make this change.", code: "42501" } },
    });
    renderProfile();

    await user.type(await screen.findByLabelText("Instagram"), "@salsaacademy");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your role on this listing cannot make this change.");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("refuses a link that is not a web address before calling the database", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderProfile();

    await user.type(await screen.findByLabelText("Website"), "academy.example");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText(/Website must be a full link/)).toBeInTheDocument();
    expect(screen.getByLabelText("Website")).toHaveFocus();
    expect(rpc).not.toHaveBeenCalledWith("entity_profile_save", expect.anything());
  });

  it("keeps an editor out of the form", async () => {
    serve(schoolWorkspace({ role: "editor" }));
    renderProfile();

    expect(await screen.findByText(/only owners and managers change the public profile/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Public profile" })).not.toBeInTheDocument();
  });

  it("offers a venue its own field set", async () => {
    const venue: EntityWorkspace = {
      kind: "venue",
      role: "owner",
      members: [],
      upcoming: [],
      offerings: null,
      entity: {
        id: "venue-1",
        name: "Havana Club",
        slug: "havana-club",
        status: "active",
        city: "boston",
        state_region: null,
        country: null,
        address_line1: "5 Main St",
        address_line2: null,
        postal_code: null,
        website: null,
        instagram: null,
        phone: null,
      },
    };
    serve(venue);
    renderProfile("venue");

    await waitFor(() => expect(screen.getByLabelText("Address line 2")).toBeInTheDocument());
    expect(screen.getByLabelText("Street address")).toHaveValue("5 Main St");
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });
});
