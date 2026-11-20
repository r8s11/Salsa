import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccessibleDialog } from "../../../../shared/a11y/useAccessibleDialog";
import { useMetros } from "../../../metros/hooks/useMetros";
import { fetchAdminEntityDirectory } from "../../entities/api/entitiesRepo";
import { useAdminUsers } from "../../hooks/useAdminUsers";
import { useAssignOrganizerMember } from "../../hooks/useOrganizerAccess";
import {
  MEMBER_ROLES,
  MEMBER_ROLE_ACCESS,
  MEMBER_ROLE_LABEL,
  organizerAccessErrorMessage,
  type AssignOrganizerMemberResult,
  type OrganizerMemberRole,
} from "../../model/organizerAccess";
import { displayNameFor, type AdminUserRow } from "../../model/usersQuery";
import "./AssignOrganizerMemberDialog.css";

export interface FixedUser {
  id: string;
  name: string;
}
export interface FixedOrganizer {
  id: string;
  name: string;
}

interface Props {
  /** Set when the dialog opens from a user page; otherwise the admin picks one. */
  user?: FixedUser;
  /** Set when the dialog opens from an organizer context; otherwise the admin picks one. */
  organizer?: FixedOrganizer;
  onClose: () => void;
  /** Called once the assignment is saved, with the resulting access. */
  onAssigned?: (result: AssignOrganizerMemberResult) => void;
}

type Step = "form" | "review" | "done";
const MAX_RESULTS = 8;

function useDebounced(value: string, ms = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const OUTCOME_COPY: Record<AssignOrganizerMemberResult["outcome"], string> = {
  created: "added to the team",
  reactivated: "restored to the team",
  role_changed: "given a new team role",
  unchanged: "already had this access, so nothing changed",
};

export default function AssignOrganizerMemberDialog({
  user: fixedUser,
  organizer: fixedOrganizer,
  onClose,
  onAssigned,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const assign = useAssignOrganizerMember();
  const { metros } = useMetros();

  const [step, setStep] = useState<Step>("form");
  const [role, setRole] = useState<OrganizerMemberRole>("owner");
  const [result, setResult] = useState<AssignOrganizerMemberResult | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [pickedUser, setPickedUser] = useState<FixedUser | null>(null);
  const { users, isLoading: usersLoading, error: usersError } = useAdminUsers();
  const userMatches = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (users ?? [])
      .filter(
        (row: AdminUserRow) =>
          row.kind === "profile" &&
          row.status === "active" &&
          `${row.display_name ?? ""} ${row.username ?? ""} ${row.email}`
            .toLowerCase()
            .includes(needle)
      )
      .slice(0, MAX_RESULTS);
  }, [users, userQuery]);

  const [orgMode, setOrgMode] = useState<"existing" | "create">("existing");
  const [orgQuery, setOrgQuery] = useState("");
  const [pickedOrg, setPickedOrg] = useState<FixedOrganizer | null>(null);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const debouncedOrgQuery = useDebounced(orgQuery.trim());
  const orgSearch = useQuery({
    queryKey: ["admin", "organizer-search", debouncedOrgQuery],
    queryFn: () =>
      fetchAdminEntityDirectory({ kind: "organizer", query: debouncedOrgQuery, status: "active" }),
    enabled: !fixedOrganizer && orgMode === "existing" && debouncedOrgQuery.length >= 2,
  });

  const user = fixedUser ?? pickedUser;
  const organizer = fixedOrganizer ?? (orgMode === "existing" ? pickedOrg : null);
  const creating = !fixedOrganizer && orgMode === "create";
  const cleanName = newName.trim();
  const organizerLabel = creating ? `${cleanName} (new organizer)` : (organizer?.name ?? "");
  const canReview = Boolean(user) && (creating ? cleanName.length >= 2 : Boolean(organizer));

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onClose,
    isBusy: assign.isPending,
    initialFocusRef: firstFieldRef,
  });

  const submit = () => {
    if (!user) return;
    assign.mutate(
      {
        userId: user.id,
        role,
        ...(creating
          ? { newOrganizer: { name: cleanName, ...(newCity ? { primary_city: newCity } : {}) } }
          : { organizerId: organizer!.id }),
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setStep("done");
          onAssigned?.(data);
        },
      }
    );
  };

  const errorText = assign.error ? organizerAccessErrorMessage(assign.error) : null;

  return (
    <div className="assign-organizer__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="assign-organizer admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <h2 id={titleId}>
          {step === "done"
            ? "Access updated"
            : step === "review"
              ? "Review access"
              : "Assign to organizer"}
        </h2>

        {step === "form" && (
          <form
            className="assign-organizer__form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canReview) setStep("review");
            }}
          >
            <p className="assign-organizer__intro">
              Team membership decides who can manage an organizer&apos;s events. It is separate from
              the account&apos;s platform role.
            </p>

            {fixedUser ? (
              <p className="assign-organizer__fixed">
                <span>User</span> <strong>{fixedUser.name}</strong>
              </p>
            ) : (
              <fieldset className="assign-organizer__group">
                <legend>User</legend>
                <input
                  ref={firstFieldRef}
                  className="admin-input"
                  type="search"
                  aria-label="Search users by name, username or email"
                  placeholder="Search by name, username or email"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                />
                {usersLoading && <p role="status">Loading users…</p>}
                {usersError && (
                  <p role="alert">We couldn&apos;t load users. Close and try again.</p>
                )}
                {userQuery.trim().length >= 2 && !usersLoading && userMatches.length === 0 && (
                  <p role="status">No active users match “{userQuery.trim()}”.</p>
                )}
                {userMatches.map((row) => (
                  <label key={row.id} className="assign-organizer__choice">
                    <input
                      type="radio"
                      name="assign-user"
                      checked={pickedUser?.id === row.user_id}
                      onChange={() =>
                        setPickedUser({ id: row.user_id!, name: displayNameFor(row) })
                      }
                    />
                    <span>
                      {displayNameFor(row)} <small>{row.email}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {fixedOrganizer ? (
              <p className="assign-organizer__fixed">
                <span>Organizer</span> <strong>{fixedOrganizer.name}</strong>
              </p>
            ) : (
              <fieldset className="assign-organizer__group">
                <legend>Organizer</legend>
                {orgMode === "existing" ? (
                  <>
                    <input
                      ref={fixedUser ? firstFieldRef : undefined}
                      className="admin-input"
                      type="search"
                      aria-label="Search active organizers"
                      placeholder="Search organizers by name"
                      value={orgQuery}
                      onChange={(event) => setOrgQuery(event.target.value)}
                    />
                    {orgSearch.isFetching && <p role="status">Searching…</p>}
                    {orgSearch.isError && (
                      <p role="alert">
                        We couldn&apos;t search organizers.{" "}
                        <button
                          type="button"
                          className="assign-organizer__link"
                          onClick={() => orgSearch.refetch()}
                        >
                          Try again
                        </button>
                      </p>
                    )}
                    {(orgSearch.data ?? []).slice(0, MAX_RESULTS).map((row) => (
                      <label key={row.id} className="assign-organizer__choice">
                        <input
                          type="radio"
                          name="assign-organizer"
                          checked={pickedOrg?.id === row.id}
                          onChange={() => setPickedOrg({ id: row.id, name: row.name })}
                        />
                        <span>
                          {row.name} {row.city && <small>{row.city}</small>}
                        </span>
                      </label>
                    ))}
                    {debouncedOrgQuery.length >= 2 &&
                      orgSearch.isSuccess &&
                      orgSearch.data.length === 0 && (
                        <p role="status">No active organizer named “{debouncedOrgQuery}”.</p>
                      )}
                    <button
                      type="button"
                      className="assign-organizer__link"
                      onClick={() => {
                        setNewName(orgQuery.trim());
                        setOrgMode("create");
                      }}
                    >
                      Not listed? Create a new organizer
                    </button>
                  </>
                ) : (
                  <>
                    <label className="admin-field">
                      <span>New organizer name</span>
                      <input
                        className="admin-input"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        maxLength={120}
                      />
                    </label>
                    <label className="admin-field">
                      <span>City (optional)</span>
                      <select
                        className="admin-select"
                        value={newCity}
                        onChange={(event) => setNewCity(event.target.value)}
                      >
                        <option value="">No city</option>
                        {metros.map((metro) => (
                          <option key={metro.slug} value={metro.slug}>
                            {metro.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="assign-organizer__link"
                      onClick={() => setOrgMode("existing")}
                    >
                      Search existing organizers instead
                    </button>
                  </>
                )}
              </fieldset>
            )}

            <fieldset className="assign-organizer__group">
              <legend>Team role</legend>
              {MEMBER_ROLES.map((value) => (
                <label key={value} className="assign-organizer__choice">
                  <input
                    type="radio"
                    name="assign-role"
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <span>
                    {MEMBER_ROLE_LABEL[value]} <small>{MEMBER_ROLE_ACCESS[value]}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="assign-organizer__actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={!canReview}>
                Review
              </button>
            </div>
          </form>
        )}

        {step === "review" && user && (
          <div className="assign-organizer__form">
            <p role="status">
              <strong>{user.name}</strong> will become <strong>{MEMBER_ROLE_LABEL[role]}</strong> of{" "}
              <strong>{organizerLabel}</strong>.
            </p>
            <p className="assign-organizer__intro">{MEMBER_ROLE_ACCESS[role]}</p>
            {errorText && (
              <p role="alert" className="assign-organizer__error">
                {errorText}
              </p>
            )}
            <div className="assign-organizer__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                disabled={assign.isPending}
                onClick={() => {
                  assign.reset();
                  setStep("form");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={assign.isPending}
                aria-busy={assign.isPending}
                onClick={submit}
              >
                {assign.isPending ? "Saving…" : "Confirm assignment"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && user && (
          <div className="assign-organizer__form">
            <p role="status">
              <strong>{user.name}</strong> was {OUTCOME_COPY[result.outcome]} as{" "}
              <strong>{MEMBER_ROLE_LABEL[result.member_role]}</strong> of{" "}
              <strong>
                {result.organizer_created ? cleanName : (organizer?.name ?? "the organizer")}
              </strong>
              {result.organizer_created ? " (new organizer created)" : ""}.
            </p>
            <p className="assign-organizer__intro">{MEMBER_ROLE_ACCESS[result.member_role]}</p>
            {result.user_platform_role !== "organizer" && (
              <p className="assign-organizer__intro">
                Their platform role is {result.user_platform_role}. Team membership alone grants
                Host access; change the platform role separately if needed.
              </p>
            )}
            <div className="assign-organizer__actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
