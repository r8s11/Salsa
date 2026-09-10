import { Building2, ShieldCheck, Shield } from "lucide-react";
import { ROLE_LABEL, type UserRole } from "../../features/admin/model/usersQuery";

// Role is the quiet axis: the default "user" role renders as plain muted
// text with no pill, and only elevated roles earn a badge at all. Icon +
// ink + border differ per elevated role so the distinction survives
// greyscale, not just colour.
const ROLE_ICON: Partial<Record<UserRole, typeof Building2>> = {
  organizer: Building2,
  moderator: ShieldCheck,
  admin: Shield,
};

export default function AdminRoleBadge({ role }: { role: UserRole | null }) {
  if (role === null) {
    return (
      <span className="admin-role admin-role--guest">
        <span aria-hidden="true">—</span>
        <span className="admin-visually-hidden">No role — no profile</span>
      </span>
    );
  }

  const Icon = ROLE_ICON[role];

  return (
    <span className={`admin-role admin-role--${role}`}>
      {Icon && <Icon size={12} />}
      {ROLE_LABEL[role]}
    </span>
  );
}
