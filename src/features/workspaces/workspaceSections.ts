import {
  MEMBER_ROLE_LABELS,
  canEditProfile,
  canManageTeam,
  workspacePath,
  type ManagedKind,
  type WorkspaceRole,
  type WorkspaceSection,
} from "./model";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  ...MEMBER_ROLE_LABELS,
  admin: "Platform admin",
};

export type WorkspaceSectionLink = {
  key: "overview" | WorkspaceSection;
  label: string;
  to: string;
};

/**
 * The pages one listing's workspace offers this role. The sidebar and the
 * in-page section links read the same list, so neither can offer a page the
 * other hides (Team is owners', Profile is owners' and managers').
 */
export function workspaceSections(
  kind: ManagedKind,
  id: string,
  role: WorkspaceRole
): WorkspaceSectionLink[] {
  const sections: WorkspaceSectionLink[] = [
    { key: "overview", label: "Overview", to: workspacePath(kind, id) },
  ];
  if (kind === "school") {
    sections.push(
      { key: "timetable", label: "Timetable", to: workspacePath(kind, id, "timetable") },
      { key: "privates", label: "Privates", to: workspacePath(kind, id, "privates") },
      { key: "prices", label: "Prices", to: workspacePath(kind, id, "prices") }
    );
  }
  if (canEditProfile(role)) {
    sections.push({ key: "profile", label: "Profile", to: workspacePath(kind, id, "profile") });
  }
  if (canManageTeam(role)) {
    sections.push({ key: "team", label: "Team", to: workspacePath(kind, id, "team") });
  }
  return sections;
}
