import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import WorkspaceField from "../components/WorkspaceField";
import WorkspaceFrame from "../components/WorkspaceFrame";
import { errorMessage, useSaveProfile } from "../hooks/useEntityWorkspace";
import {
  canEditProfile,
  type EntityWorkspace,
  type InstructorProfile,
  type ManagedKind,
  type ProfilePatch,
  type SchoolProfile,
  type VenueProfile,
} from "../model";
import { PUBLIC_PATH_PREFIX } from "../offeringForm";

type FieldSpec = {
  key: string;
  label: string;
  kind?: "textarea" | "url" | "tel";
  hint?: string;
};

const WEBSITE: FieldSpec = { key: "website", label: "Website", kind: "url", hint: "Start with https://" };
const INSTAGRAM: FieldSpec = { key: "instagram", label: "Instagram", hint: "A handle like @salsalab, or the profile link." };
const IMAGE: FieldSpec = { key: "image_url", label: "Image link", kind: "url", hint: "A full https:// link to a photo you have the rights to use." };

/** Exactly the fields entity_profile_save accepts for each kind. */
const PROFILE_FIELDS: Record<ManagedKind, FieldSpec[]> = {
  school: [
    { key: "description", label: "Description", kind: "textarea" },
    IMAGE,
    WEBSITE,
    INSTAGRAM,
    { key: "phone", label: "Phone", kind: "tel" },
    { key: "address_line1", label: "Street address" },
    { key: "postal_code", label: "Postal code" },
  ],
  venue: [
    WEBSITE,
    INSTAGRAM,
    { key: "phone", label: "Phone", kind: "tel" },
    { key: "address_line1", label: "Street address" },
    { key: "address_line2", label: "Address line 2" },
    { key: "postal_code", label: "Postal code" },
  ],
  instructor: [
    { key: "description", label: "Bio", kind: "textarea" },
    IMAGE,
    WEBSITE,
    INSTAGRAM,
    { key: "organization", label: "Organization" },
  ],
};

type ProfileEntity = SchoolProfile | VenueProfile | InstructorProfile;

function readField(entity: ProfileEntity, key: string): string {
  const value = (entity as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

type ProfilePageProps = { kind: ManagedKind };

export default function EntityWorkspaceProfilePage({ kind }: ProfilePageProps) {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind={kind} id={id} section="Profile">
      {(workspace) => <ProfileBody workspace={workspace} />}
    </WorkspaceFrame>
  );
}

function ProfileBody({ workspace }: { workspace: EntityWorkspace }) {
  const { kind, entity, role } = workspace;
  const fields = PROFILE_FIELDS[kind];
  const editable = canEditProfile(role);
  const save = useSaveProfile(kind, entity.id);

  const saved = Object.fromEntries(fields.map(({ key }) => [key, readField(entity, key)]));
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<"idle" | "saved">("idle");

  const dirty = fields.some(({ key }) => draft[key].trim() !== saved[key].trim());

  const setField = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setOutcome("idle");
    save.reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    for (const { key, label, kind: type } of fields) {
      const value = draft[key].trim();
      if (type === "url" && value !== "" && !isWebLink(value)) {
        found[key] = `${label} must be a full link starting with https://`;
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstBad = fields.find(({ key }) => found[key]);
      if (firstBad) event.currentTarget.querySelector<HTMLElement>(`[name="${firstBad.key}"]`)?.focus();
      return;
    }
    const patch = Object.fromEntries(fields.map(({ key }) => [key, draft[key].trim()]));
    try {
      await save.mutateAsync(patch as ProfilePatch[typeof kind]);
      setOutcome("saved");
    } catch {
      setOutcome("idle");
    }
  };

  const publicPath = `${PUBLIC_PATH_PREFIX[kind]}/${entity.slug}`;

  return (
    <div className="ws-body ws-body--measure">
      <dl className="ws-identity">
        <dt>Name</dt>
        <dd>{entity.name}</dd>
        <dt>City</dt>
        <dd>{entity.city ?? "—"}</dd>
        <dt>Address</dt>
        <dd>
          <Link to={publicPath}>{publicPath}</Link>
        </dd>
      </dl>
      <p className="ws-note">
        The name, city and page address are set by Salsa Segura.{" "}
        <Link to="/contact">Contact Salsa Segura</Link> to change them.
      </p>

      {!editable ? (
        <p className="ws-note" role="status">
          Editors keep the timetable, privates and prices up to date; only owners and managers
          change the public profile.
        </p>
      ) : (
        <form className="ws-form" aria-label="Public profile" noValidate onSubmit={submit}>
          <div className="ws-form__grid">
            {fields.map(({ key, label, kind: type, hint }) => (
              <WorkspaceField
                key={key}
                label={label}
                hint={hint}
                error={errors[key] || undefined}
                wide={type === "textarea"}
              >
                {(control) =>
                  type === "textarea" ? (
                    <textarea
                      {...control}
                      name={key}
                      className="admin-textarea"
                      rows={5}
                      value={draft[key]}
                      onChange={(event) => setField(key, event.target.value)}
                    />
                  ) : (
                    <input
                      {...control}
                      name={key}
                      className="admin-input"
                      type={type === "url" ? "url" : type === "tel" ? "tel" : "text"}
                      value={draft[key]}
                      onChange={(event) => setField(key, event.target.value)}
                    />
                  )
                }
              </WorkspaceField>
            ))}
          </div>

          <div className="ws-form__actions">
            <button
              type="submit"
              className="desk__action desk__action--primary"
              disabled={save.isPending || !dirty}
            >
              {save.isPending ? "Saving…" : "Save profile"}
            </button>
            {save.isError ? (
              <p className="ws-status ws-status--error" role="alert">
                {errorMessage(save.error)}
              </p>
            ) : (
              <p className="ws-status" role="status">
                {outcome === "saved" ? "Saved." : ""}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
