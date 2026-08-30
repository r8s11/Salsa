import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useOwnProfile } from "../hooks/useOwnProfile";
import { useUpdateOwnProfile } from "../hooks/useUpdateOwnProfile";
import { resolveIdentity, initialsFor, SAFE_NAME_FALLBACK, type OwnProfile } from "../features/account/model/account";
import "./ProfileEditPage.css";

type FormState = {
  display_name: string;
  username: string;
  avatar_url: string;
};

type SavedNotice = { kind: "success"; message: string };

function formStateFromProfile(profile: OwnProfile): FormState {
  return {
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
    avatar_url: profile.avatar_url ?? "",
  };
}

function sanitizeUsernameInput(value: string): string {
  // Lowercased, single @, only the slug character set the public.profiles
  // username_unique index expects. This is the existing app's convention;
  // full username-lifecycle rules belong to Phase 7.
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ProfileEditPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isLoading, error, refetch } = useOwnProfile(user?.id);
  const { update, isSaving, error: saveError } = useUpdateOwnProfile(user?.id);

  const displayNameId = useId();
  const usernameId = useId();
  const avatarUrlId = useId();
  const avatarUrlErrorId = useId();
  const pageErrorId = useId();

  const [form, setForm] = useState<FormState | null>(null);
  const [avatarUrlError, setAvatarUrlError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate form from fetched profile; intended external sync
      setForm(formStateFromProfile(profile));
    }
  }, [profile]);

  const identity = profile ? resolveIdentity(profile) : null;
  const initials = identity ? initialsFor(identity) : "·";
  const dirty =
    form !== null &&
    profile !== null &&
    (form.display_name !== (profile.display_name ?? "") ||
      form.username !== (profile.username ?? "") ||
      form.avatar_url !== (profile.avatar_url ?? ""));
  const canSave =
    !isSaving &&
    form !== null &&
    profile !== null &&
    dirty &&
    form.display_name.trim().length > 0 &&
    !avatarUrlError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !profile || !canSave) return;
    setSaved(null);

    const trimmedDisplayName = form.display_name.trim();
    const cleanedUsername = sanitizeUsernameInput(form.username);
    const cleanedAvatarUrl = form.avatar_url.trim();

    try {
      await update({
        display_name: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
        username: cleanedUsername.length > 0 ? cleanedUsername : null,
        avatar_url: cleanedAvatarUrl.length > 0 ? cleanedAvatarUrl : null,
      });
      setSaved({ kind: "success", message: "Saved. Your profile is up to date." });
    } catch {
      // The mutation surfaces the raw Supabase message via `saveError`; we
      // intentionally do not duplicate it as a thrown message.
    }
  };

  const handleCancel = () => {
    navigate("/profile");
  };

  const handleAvatarUrlChange = (value: string) => {
    setForm((current) => (current ? { ...current, avatar_url: value } : current));
    setSaved(null);
    if (value.trim().length === 0 || isValidUrl(value.trim())) {
      setAvatarUrlError(null);
    } else {
      setAvatarUrlError("Use a full link starting with https://");
    }
  };

  return (
    <main className="profile-edit-page">
      <div className="profile-edit-page__intro">
        <Link to="/profile" className="profile-edit-page__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to my profile
        </Link>
        <span className="profile-edit-page__eyebrow">PROFILE SETTINGS</span>
        <h1 className="profile-edit-page__h1">Profile settings</h1>
        <p className="profile-edit-page__lede">
          Manage the information people see when they visit your SalsaSegura profile.
        </p>
      </div>

      {isLoading && (
        <div className="profile-edit-page__card profile-edit-page__skeleton" aria-busy="true">
          <p role="status" className="profile-edit-page__visually-hidden">
            Loading your profile…
          </p>
          <span
            className="profile-edit-page__skel profile-edit-page__skel--avatar"
            aria-hidden="true"
          />
          <div className="profile-edit-page__skel-lines" aria-hidden="true">
            <span className="profile-edit-page__skel profile-edit-page__skel--line" />
            <span className="profile-edit-page__skel profile-edit-page__skel--line profile-edit-page__skel--short" />
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="profile-edit-page__card profile-edit-page__error" role="alert">
          <p>We couldn't load your profile.</p>
          <button
            type="button"
            className="profile-edit-page__btn profile-edit-page__btn--outline"
            onClick={() => refetch()}
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && profile && form && (
        <form className="profile-edit-page__form" onSubmit={handleSubmit} noValidate>
          {saved && (
            <p className="profile-edit-page__notice" role="status">
              {saved.message}
            </p>
          )}

          <section
            className="profile-edit-page__card profile-edit-page__identity"
            aria-labelledby="profile-edit-identity-heading"
          >
            <h2 id="profile-edit-identity-heading" className="profile-edit-page__section-title">
              PHOTO &amp; NAME
            </h2>

            <div className="profile-edit-page__identity-row">
              <div className="profile-edit-page__avatar-column">
                {form.avatar_url.trim().length > 0 ? (
                  <img
                    className="profile-edit-page__avatar"
                    src={form.avatar_url}
                    alt=""
                    width={148}
                    height={148}
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="profile-edit-page__avatar profile-edit-page__avatar--initials"
                    aria-hidden="true"
                  >
                    <Camera size={28} />
                    <span className="profile-edit-page__avatar-initials">{initials}</span>
                  </span>
                )}
                <p className="profile-edit-page__avatar-hint">
                  Photo URL — link to a hosted image. Uploads arrive in a later update.
                </p>
              </div>

              <div className="profile-edit-page__identity-fields">
                <div className="profile-edit-page__field">
                  <label htmlFor={displayNameId} className="profile-edit-page__label">
                    Display Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={displayNameId}
                    className="profile-edit-page__input"
                    type="text"
                    required
                    value={form.display_name}
                    onChange={(event) => {
                      setForm((current) =>
                        current ? { ...current, display_name: event.target.value } : current
                      );
                      setSaved(null);
                    }}
                    placeholder={SAFE_NAME_FALLBACK}
                    maxLength={80}
                  />
                </div>

                <div className="profile-edit-page__field">
                  <label htmlFor={usernameId} className="profile-edit-page__label">
                    Username
                  </label>
                  <input
                    id={usernameId}
                    className="profile-edit-page__input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.username}
                    onChange={(event) => {
                      setForm((current) =>
                        current
                          ? { ...current, username: sanitizeUsernameInput(event.target.value) }
                          : current
                      );
                      setSaved(null);
                    }}
                    placeholder="your-handle"
                    maxLength={32}
                  />
                  <p className="profile-edit-page__hint">
                    {form.username
                      ? `salsasegura.com/u/${form.username}`
                      : "Shown on your public profile and submissions."}
                  </p>
                </div>
              </div>
            </div>

            <div className="profile-edit-page__field">
              <label htmlFor={avatarUrlId} className="profile-edit-page__label">
                Photo URL
              </label>
              <input
                id={avatarUrlId}
                className="profile-edit-page__input"
                type="url"
                value={form.avatar_url}
                onChange={(event) => handleAvatarUrlChange(event.target.value)}
                placeholder="https://"
                aria-invalid={avatarUrlError ? true : undefined}
                aria-describedby={avatarUrlError ? avatarUrlErrorId : undefined}
              />
              {avatarUrlError && (
                <p id={avatarUrlErrorId} className="profile-edit-page__error" role="alert">
                  {avatarUrlError}
                </p>
              )}
            </div>
          </section>

          {saveError && (
            <p id={pageErrorId} className="profile-edit-page__error" role="alert">
              We couldn't save your changes. Please try again.
            </p>
          )}

          <div className="profile-edit-page__actions">
            <button
              type="button"
              className="profile-edit-page__btn profile-edit-page__btn--outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="profile-edit-page__btn profile-edit-page__btn--primary"
              disabled={!canSave}
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
