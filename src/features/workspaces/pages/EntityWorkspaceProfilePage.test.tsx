import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntityWorkspaceProfilePage from "./EntityWorkspaceProfilePage";
import { renderWorkspacePage, schoolWorkspace, venueWorkspace } from "./workspaceTestKit";
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
    expect(screen.getByRole("link", { name: "Request a change" })).toHaveAttribute("href", "/host/schools/school-1/requests");
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

  it("offers venue public and private fields with rights guidance", async () => {
    serve(venueWorkspace());
    renderProfile("venue");
    const description = await screen.findByLabelText("Description");
    expect(description).toHaveAttribute("maxlength", "1200");
    expect(description).toHaveAccessibleDescription(/Shown on your public page/);
    expect(screen.getByLabelText("Street address")).toHaveValue("5 Main St");
    expect(screen.getByLabelText("Street address")).toHaveAccessibleDescription(/Shown on your public page/);
    expect(screen.getByLabelText("Image link")).toHaveAccessibleDescription(/written permission to publish/);
    for (const label of ["Phone", "Address line 2", "Postal code"]) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/Not shown on your public page/);
    }
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("saves the boundary description and HTTPS image in a venue patch", async () => {
    serve(venueWorkspace());
    renderProfile("venue");
    fireEvent.change(await screen.findByLabelText("Description"), { target: { value: "x".repeat(1200) } });
    fireEvent.change(screen.getByLabelText("Image link"), { target: { value: "https://img.example/club.jpg" } });
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("entity_profile_save", { p_kind: "venue", p_id: "venue-1", p_payload: expect.objectContaining({ description: "x".repeat(1200), image_url: "https://img.example/club.jpg" }) });
  });

  it.each(["http://img.example/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "https://img.example/a b.jpg", "https://" + "x".repeat(2041)])("refuses unsafe venue image %s before saving", async (value) => {
    serve(venueWorkspace());
    renderProfile("venue");
    fireEvent.change(await screen.findByLabelText("Image link"), { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText(/Image link must be a full link starting with https/)).toBeInTheDocument();
    expect(screen.getByLabelText("Image link")).toHaveFocus();
    expect(rpc.mock.calls.some(([name]) => name === "entity_profile_save")).toBe(false);
  });

  it("clears an existing venue image", async () => {
    const workspace = venueWorkspace();
    workspace.entity.image_url = "https://img.example/old.jpg";
    serve(workspace);
    renderProfile("venue");
    fireEvent.change(await screen.findByLabelText("Image link"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("entity_profile_save", expect.objectContaining({ p_payload: expect.objectContaining({ image_url: "" }) }));
  });

  it("shows server refusals for venue edits", async () => {
    serve(venueWorkspace(), { entity_profile_save: { data: null, error: { message: "Image link must be a full https:// link.", code: "22023" } } });
    renderProfile("venue");
    fireEvent.change(await screen.findByLabelText("Description"), { target: { value: "Friday nights" } });
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Image link must be a full https:// link.");
  });

  it("keeps venue editors out of the profile form", async () => {
    serve(venueWorkspace({ role: "editor" }));
    renderProfile("venue");
    expect(await screen.findByText(/only owners and managers change the public profile/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Public profile" })).not.toBeInTheDocument();
  });
});
