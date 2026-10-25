import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EntityEditButton } from "./EntityEditButton";

const state = vi.hoisted(() => ({ user: { id: "user-1" } as { id: string } | null, isAdmin: false, memberships: [] as { kind: string; id: string; member_role: string }[] }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => state }));
vi.mock("../../workspaces/hooks/useMyEntityMemberships", () => ({ useMyEntityMemberships: () => ({ data: state.memberships }) }));

describe("EntityEditButton permissions", () => {
  it.each(["owner", "manager", "editor", "unrelated", "anonymous", "admin"])("respects %s access", (role) => {
    state.user = role === "anonymous" ? null : { id: "user-1" };
    state.isAdmin = role === "admin";
    state.memberships = [{ kind: "school", id: role === "unrelated" ? "other-school" : "school-1", member_role: role }];
    render(<MemoryRouter><EntityEditButton kind="school" id="school-1" /></MemoryRouter>);
    if (["anonymous", "unrelated", "editor"].includes(role)) {
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("link", { name: "Edit school" })).toHaveAttribute("href", role === "admin" ? "/admin/schools/school-1" : "/host/schools/school-1/profile");
    }
  });
});
