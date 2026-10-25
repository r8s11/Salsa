import { Pencil } from "lucide-react";
import ButtonLink from "../../../components/ui/ButtonLink";
import { useAuth } from "../../../contexts/useAuth";
import { useMyEntityMemberships } from "../../workspaces/hooks/useMyEntityMemberships";
import { canEditProfile, workspacePath } from "../../workspaces/model";
import type { PublicEntityKind } from "../model";

/** Use existing protected editors; this affordance grants no additional permissions. */
export function EntityEditButton({ kind, id }: { kind: PublicEntityKind; id: string }) {
  const { user, isAdmin } = useAuth();
  const { data: memberships } = useMyEntityMemberships();
  if (!user) return null;

  let to: string | undefined;
  if (isAdmin && ["school", "instructor", "venue", "organizer", "series"].includes(kind)) {
    to = `/admin/${kind === "series" ? "series" : `${kind}s`}/${id}`;
  } else if (kind === "school" || kind === "instructor" || kind === "venue") {
    const membership = memberships?.find((member) => member.kind === kind && member.id === id);
    if (membership && canEditProfile(membership.member_role)) {
      to = workspacePath(kind, id, "profile");
    }
  }
  if (!to) return null;

  return (
    <ButtonLink to={to} variant="secondary">
      <Pencil size={16} aria-hidden="true" />
      Edit {kind === "instructor" ? "profile" : kind}
    </ButtonLink>
  );
}
