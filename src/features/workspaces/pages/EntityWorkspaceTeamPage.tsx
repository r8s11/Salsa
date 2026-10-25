import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import AdminConfirmDialog from "../../admin/components/common/AdminConfirmDialog";
import WorkspaceField from "../components/WorkspaceField";
import WorkspaceFrame from "../components/WorkspaceFrame";
import {
  errorMessage,
  useAddMember,
  useChangeMemberRole,
  useRemoveMember,
} from "../hooks/useEntityWorkspace";
import {
  MEMBER_ROLE_LABELS,
  canManageTeam,
  type EntityMemberRole,
  type EntityWorkspace,
  type ManagedKind,
  type WorkspaceMember,
} from "../model";

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as EntityMemberRole[];

type TeamPageProps = { kind: ManagedKind };

export default function EntityWorkspaceTeamPage({ kind }: TeamPageProps) {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind={kind} id={id} section="Team">
      {(workspace) => <TeamBody workspace={workspace} />}
    </WorkspaceFrame>
  );
}

function memberName(member: WorkspaceMember): string {
  return member.display_name?.trim() || member.email;
}

function TeamBody({ workspace }: { workspace: EntityWorkspace }) {
  const { kind, entity, members, role } = workspace;
  const editable = canManageTeam(role);
  const addMember = useAddMember(kind, entity.id);
  const changeRole = useChangeMemberRole(kind, entity.id);
  const removeMember = useRemoveMember(kind, entity.id);

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<EntityMemberRole>("manager");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);

  const submitAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter the email address of their Salsa Segura account.");
      return;
    }
    setEmailError(null);
    setAdded(null);
    try {
      await addMember.mutateAsync({ email: trimmed, role: newRole });
      setAdded(`${trimmed} is now ${MEMBER_ROLE_LABELS[newRole].toLowerCase()} of this listing.`);
      setEmail("");
    } catch {
      // The mutation holds the server's message; it renders under the form.
    }
  };

  const changeMemberRole = async (member: WorkspaceMember, next: EntityMemberRole) => {
    setChangingId(member.user_id);
    setAdded(null);
    try {
      await changeRole.mutateAsync({ userId: member.user_id, role: next });
    } catch {
      // Rendered from changeRole.error.
    } finally {
      setChangingId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeMember.mutateAsync(removing);
      setRemoving(null);
    } catch {
      // Rendered inside the dialog from removeMember.error.
    }
  };

  return (
    <div className="ws-body ws-body--measure">
      {!editable && (
        <p className="ws-note">Only owners can add people, change roles or remove them.</p>
      )}

      {changeRole.isError && (
        <p className="ws-status ws-status--error" role="alert">
          {errorMessage(changeRole.error)}
        </p>
      )}

      {members.length === 0 ? (
        <p className="ws-note">Nobody is on this team yet.</p>
      ) : (
        <ul className="ws-list" aria-label="Team members">
          {members.map((member) => (
            <li key={member.user_id} className="ws-member">
              <div>
                <p className="ws-member__name">{memberName(member)}</p>
                {member.display_name?.trim() && <p className="ws-member__email">{member.email}</p>}
              </div>
              {editable ? (
                <>
                  <select
                    className="admin-select ws-member__role-select"
                    aria-label={`Role for ${memberName(member)}`}
                    value={member.member_role}
                    disabled={changingId === member.user_id}
                    onChange={(event) =>
                      void changeMemberRole(member, event.target.value as EntityMemberRole)
                    }
                  >
                    {ROLES.map((value) => (
                      <option key={value} value={value}>
                        {MEMBER_ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="desk__action"
                    aria-label={`Remove ${memberName(member)}`}
                    onClick={() => {
                      removeMember.reset();
                      setRemoving(member);
                    }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="ws-member__role">{MEMBER_ROLE_LABELS[member.member_role]}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <section className="ws-add" aria-labelledby="ws-add-title">
          <h2 id="ws-add-title" className="ws-add__title">
            Add someone
          </h2>
          <form className="ws-form" aria-label="Add team member" noValidate onSubmit={submitAdd}>
            <div className="ws-form__grid">
              <WorkspaceField
                label="Email"
                hint="They need a Salsa Segura account first."
                error={emailError ?? undefined}
              >
                {(control) => (
                  <input
                    {...control}
                    className="admin-input"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError(null);
                      setAdded(null);
                      addMember.reset();
                    }}
                  />
                )}
              </WorkspaceField>
              <WorkspaceField label="Role">
                {(control) => (
                  <select
                    {...control}
                    className="admin-select"
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value as EntityMemberRole)}
                  >
                    {ROLES.map((value) => (
                      <option key={value} value={value}>
                        {MEMBER_ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                )}
              </WorkspaceField>
            </div>
            {addMember.isError && (
              <p className="ws-form__alert" role="alert">
                {errorMessage(addMember.error)}
              </p>
            )}
            <div className="ws-form__actions">
              <button
                type="submit"
                className="desk__action desk__action--primary"
                disabled={addMember.isPending}
              >
                {addMember.isPending ? "Adding…" : "Add to team"}
              </button>
              <p className="ws-status" role="status">
                {added}
              </p>
            </div>
          </form>
        </section>
      )}

      {removing && (
        <AdminConfirmDialog
          title={`Remove ${memberName(removing)}?`}
          body={`${memberName(removing)} will lose access to this listing’s workspace. You can add them back later.`}
          confirmLabel="Remove from team"
          busyLabel="Removing…"
          isBusy={removeMember.isPending}
          error={removeMember.isError ? errorMessage(removeMember.error) : null}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
