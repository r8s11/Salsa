import { UserRound } from "lucide-react";
import { initialsFor, type AdminUserRow } from "../../features/admin/model/usersQuery";

export default function AdminUserAvatar({
  row,
  size = 40,
}: {
  row: AdminUserRow;
  size?: number;
}) {
  if (row.kind === "guest") {
    return (
      <span
        className="admin-users-table__avatar admin-users-table__avatar--guest"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <UserRound size={Math.round(size * 0.45)} />
      </span>
    );
  }
  if (row.avatar_url) {
    return <img src={row.avatar_url} alt="" loading="lazy" width={size} height={size} />;
  }
  return (
    <span
      className="admin-users-table__avatar admin-users-table__avatar--initials"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initialsFor(row)}
    </span>
  );
}
