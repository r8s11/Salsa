import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import { useUpdateOwnProfile } from "../../features/account/hooks/useUpdateOwnProfile";
import {
  resolveIdentity,
  initialsFor,
  isDisplayablePhotoUrl,
  notificationPrefEnabled,
  NOTIFICATION_PREFS,
  SAFE_NAME_FALLBACK,
  type NotificationPrefKey,
  type NotificationPrefs,
  type OwnProfile,
} from "../../features/account/model/account";
import { CITY_LABEL, DANCE_STYLES } from "../../features/admin/model/eventsQuery";
import type { City } from "../../features/events/model/types";
import "./ProfileEditPage.css";

const BIO_MAX_LENGTH = 600;

const CITY_OPTIONS = Object.entries(CITY_LABEL) as [City, string][];

type FormState = {
  display_name: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  city: City | "";
  dance_styles: string[];
  instagram: string;
  website: string;
  public_profile: boolean;
  stats_public: boolean;
  notification_prefs: NotificationPrefs;
};

type SavedNotice = { kind: "success"; message: string };

function formStateFromProfile(profile: OwnProfile): FormState {
  return {
    display_name: profile.display_name ?? "",
    avatar_url: profile.avatar_url ?? "",
    cover_url: profile.cover_url ?? "",
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    dance_styles: [...(profile.dance_styles ?? [])],
    instagram: profile.instagram ?? "",
    website: profile.website ?? "",
    public_profile: profile.public_profile,
    stats_public: profile.stats_public,
    notification_prefs: { ...(profile.notification_prefs ?? {}) },
  };
}

/**
 * The database stores links only as http(s) (profiles_instagram_http /
 * profiles_website_http / profiles_cover_url_http), so the editor rejects
 * anything else before the round-trip rather than surfacing a raw
 * constraint violation.
 */
function linkError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return /^https?:\/\//i.test(trimmed) ? null : "Use a full link starting with https://";
}


export default function ProfileEditPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isLoading, error, refetch } = useOwnProfile(user?.id);
  const { update, isSaving, error: saveError } = useUpdateOwnProfile(user?.id);

  const displayNameId = useId();
  const displayNameErrorId = useId();
  const usernameId = useId();
  const usernameHelpId = useId();
  const avatarUrlId = useId();
  const avatarUrlHintId = useId();
  const avatarUrlErrorId = useId();
  const coverUrlId = useId();
  const coverUrlErrorId = useId();
  const bioId = useId();
  const bioHintId = useId();
  const cityId = useId();
  const instagramId = useId();
  const instagramErrorId = useId();
  const websiteId = useId();
  const websiteErrorId = useId();

  const [form, setForm] = useState<FormState | null>(null);
  const [avatarUrlError, setAvatarUrlError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);
  // The exact URL whose <img> raised onError. Comparing against the current
  // value means replacing the URL automatically re-attempts the load.
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const [failedCoverPreviewUrl, setFailedCoverPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate form from fetched profile; intended external sync
      setForm(formStateFromProfile(profile));
    }
  }, [profile]);

  const identity = profile ? resolveIdentity(profile) : null;
  const initials = identity ? initialsFor(identity) : "·";
  const currentUsername = profile?.username ?? null;

  const trimmedAvatarUrl = form?.avatar_url.trim() ?? "";
  const trimmedCoverUrl = form?.cover_url.trim() ?? "";
  const displayNameBlank = form !== null && form.display_name.trim().length === 0;
  // Preview only what the save path would also accept, and only if this exact
  // URL has not already failed to load.
  const showPreview =
    isDisplayablePhotoUrl(trimmedAvatarUrl) && failedPreviewUrl !== trimmedAvatarUrl;
  const showCoverPreview =
    isDisplayablePhotoUrl(trimmedCoverUrl) && failedCoverPreviewUrl !== trimmedCoverUrl;

  const coverUrlError = form ? linkError(form.cover_url) : null;
  const instagramError = form ? linkError(form.instagram) : null;
  const websiteError = form ? linkError(form.website) : null;

  const dirty =
    form !== null &&
    profile !== null &&
    (form.display_name !== (profile.display_name ?? "") ||
      form.avatar_url !== (profile.avatar_url ?? "") ||
      form.cover_url !== (profile.cover_url ?? "") ||
      form.bio !== (profile.bio ?? "") ||
      form.city !== (profile.city ?? "") ||
      form.instagram !== (profile.instagram ?? "") ||
      form.website !== (profile.website ?? "") ||
      form.public_profile !== profile.public_profile ||
      form.stats_public !== profile.stats_public ||
      form.dance_styles.length !== (profile.dance_styles ?? []).length ||
      form.dance_styles.some((style) => !(profile.dance_styles ?? []).includes(style)) ||
      NOTIFICATION_PREFS.some(
        (pref) =>
          notificationPrefEnabled(form.notification_prefs, pref.key) !==
          notificationPrefEnabled(profile.notification_prefs, pref.key)
      ));

  const canSave =
    !isSaving &&
    form !== null &&
    profile !== null &&
    dirty &&
    form.display_name.trim().length > 0 &&
    !avatarUrlError &&
    !coverUrlError &&
    !instagramError &&
    !websiteError;

  const patchForm = (patch: Partial<FormState>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setSaved(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !profile || !canSave) return;
    setSaved(null);

    const trimmedDisplayName = form.display_name.trim();
    const orNull = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    try {
      await update({
        display_name: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
        avatar_url: orNull(form.avatar_url),
        cover_url: orNull(form.cover_url),
        bio: orNull(form.bio),
        city: form.city === "" ? null : form.city,
        dance_styles: form.dance_styles,
        instagram: orNull(form.instagram),
        website: orNull(form.website),
        public_profile: form.public_profile,
        stats_public: form.stats_public,
        notification_prefs: form.notification_prefs,
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
    patchForm({ avatar_url: value });
    const trimmed = value.trim();
    if (trimmed.length === 0 || isDisplayablePhotoUrl(trimmed)) {
      setAvatarUrlError(null);
    } else {
      setAvatarUrlError("Use a full link starting with https://");
    }
  };

  const toggleStyle = (value: string) => {
    if (!form) return;
    const next = form.dance_styles.includes(value)
      ? form.dance_styles.filter((style) => style !== value)
      : [...form.dance_styles, value];
    patchForm({ dance_styles: next });
  };

  const toggleNotification = (key: NotificationPrefKey) => {
    if (!form) return;
    patchForm({
      notification_prefs: {
        ...form.notification_prefs,
        [key]: !notificationPrefEnabled(form.notification_prefs, key),
      },
    });
  };

  return (
    // MainLayout owns the page's single <main> landmark; this section must
    // not introduce a second one.
    <div className="profile-edit-page">
      <div className="profile-edit-page__intro">
        <Link to="/profile" className="profile-edit-page__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to my profile
        </Link>
        <span className="profile-edit-page__eyebrow">PROFILE SETTINGS</span>
        <h1 className="profile-edit-page__h1">Edit profile</h1>
        <p className="profile-edit-page__lede">
          Update how you appear across SalsaSegura.
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
              PHOTOS &amp; NAME
            </h2>

            <div className="profile-edit-page__identity-row">
              <div className="profile-edit-page__avatar-column">
                {showPreview ? (
                  <img
                    className="profile-edit-page__avatar"
                    src={trimmedAvatarUrl}
                    alt=""
                    width={148}
                    height={148}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedPreviewUrl(trimmedAvatarUrl)}
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
                <p id={avatarUrlHintId} className="profile-edit-page__avatar-hint">
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
                    onChange={(event) => patchForm({ display_name: event.target.value })}
                    placeholder={SAFE_NAME_FALLBACK}
                    maxLength={80}
                    aria-invalid={displayNameBlank ? true : undefined}
                    aria-describedby={displayNameBlank ? displayNameErrorId : undefined}
                  />
                  {displayNameBlank && (
                    <p id={displayNameErrorId} className="profile-edit-page__error" role="alert">
                      A display name is required.
                    </p>
                  )}
                </div>

                <div className="profile-edit-page__field">
                  <label htmlFor={usernameId} className="profile-edit-page__label">
                    Username
                  </label>
                  <input
                    id={usernameId}
                    className="profile-edit-page__input profile-edit-page__input--readonly"
                    type="text"
                    readOnly
                    disabled
                    aria-readonly="true"
                    aria-describedby={usernameHelpId}
                    value={currentUsername ?? ""}
                    placeholder="Not set"
                  />
                  <p id={usernameHelpId} className="profile-edit-page__hint">
                    {currentUsername
                      ? `salsasegura.com/u/${currentUsername}`
                      : "No username set yet."}{" "}
                    Username changes arrive in a later update.
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
                aria-describedby={
                  avatarUrlError ? `${avatarUrlHintId} ${avatarUrlErrorId}` : avatarUrlHintId
                }
              />
              {avatarUrlError && (
                <p id={avatarUrlErrorId} className="profile-edit-page__error" role="alert">
                  {avatarUrlError}
                </p>
              )}
            </div>

            <div className="profile-edit-page__field">
              <label htmlFor={coverUrlId} className="profile-edit-page__label">
                Cover Photo URL
              </label>
              {showCoverPreview && (
                <img
                  className="profile-edit-page__cover-preview"
                  src={trimmedCoverUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedCoverPreviewUrl(trimmedCoverUrl)}
                />
              )}
              <input
                id={coverUrlId}
                className="profile-edit-page__input"
                type="url"
                value={form.cover_url}
                onChange={(event) => patchForm({ cover_url: event.target.value })}
                placeholder="https://"
                aria-invalid={coverUrlError ? true : undefined}
                aria-describedby={coverUrlError ? coverUrlErrorId : undefined}
              />
              {coverUrlError && (
                <p id={coverUrlErrorId} className="profile-edit-page__error" role="alert">
                  {coverUrlError}
                </p>
              )}
            </div>
          </section>

          <section
            className="profile-edit-page__card"
            aria-labelledby="profile-edit-about-heading"
          >
            <h2 id="profile-edit-about-heading" className="profile-edit-page__section-title">
              ABOUT YOU
            </h2>

            <div className="profile-edit-page__field">
              <label htmlFor={bioId} className="profile-edit-page__label">
                Bio
              </label>
              <textarea
                id={bioId}
                className="profile-edit-page__textarea"
                rows={4}
                value={form.bio}
                maxLength={BIO_MAX_LENGTH}
                onChange={(event) => patchForm({ bio: event.target.value })}
                placeholder="A couple of lines about how you dance and where you're usually found."
                aria-describedby={bioHintId}
              />
              <p id={bioHintId} className="profile-edit-page__hint">
                {form.bio.length} / {BIO_MAX_LENGTH} characters
              </p>
            </div>

            <div className="profile-edit-page__field">
              <label htmlFor={cityId} className="profile-edit-page__label">
                City
              </label>
              <select
                id={cityId}
                className="profile-edit-page__input"
                value={form.city}
                onChange={(event) => patchForm({ city: event.target.value as City | "" })}
              >
                <option value="">No city set</option>
                {CITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="profile-edit-page__fieldset">
              <legend className="profile-edit-page__label">Dance styles</legend>
              <div className="profile-edit-page__chips">
                {DANCE_STYLES.map((style) => {
                  const selected = form.dance_styles.includes(style.value);
                  return (
                    <button
                      key={style.value}
                      type="button"
                      className={
                        selected
                          ? "profile-edit-page__chip profile-edit-page__chip--on"
                          : "profile-edit-page__chip"
                      }
                      aria-pressed={selected}
                      onClick={() => toggleStyle(style.value)}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section
            className="profile-edit-page__card"
            aria-labelledby="profile-edit-links-heading"
          >
            <h2 id="profile-edit-links-heading" className="profile-edit-page__section-title">
              SOCIAL LINKS
            </h2>

            <div className="profile-edit-page__field">
              <label htmlFor={instagramId} className="profile-edit-page__label">
                Instagram
              </label>
              <input
                id={instagramId}
                className="profile-edit-page__input"
                type="url"
                value={form.instagram}
                onChange={(event) => patchForm({ instagram: event.target.value })}
                placeholder="https://instagram.com/…"
                aria-invalid={instagramError ? true : undefined}
                aria-describedby={instagramError ? instagramErrorId : undefined}
              />
              {instagramError && (
                <p id={instagramErrorId} className="profile-edit-page__error" role="alert">
                  {instagramError}
                </p>
              )}
            </div>

            <div className="profile-edit-page__field">
              <label htmlFor={websiteId} className="profile-edit-page__label">
                Website
              </label>
              <input
                id={websiteId}
                className="profile-edit-page__input"
                type="url"
                value={form.website}
                onChange={(event) => patchForm({ website: event.target.value })}
                placeholder="https://"
                aria-invalid={websiteError ? true : undefined}
                aria-describedby={websiteError ? websiteErrorId : undefined}
              />
              {websiteError && (
                <p id={websiteErrorId} className="profile-edit-page__error" role="alert">
                  {websiteError}
                </p>
              )}
            </div>
          </section>

          <section
            className="profile-edit-page__card"
            aria-labelledby="profile-edit-notifications-heading"
          >
            <h2
              id="profile-edit-notifications-heading"
              className="profile-edit-page__section-title"
            >
              NOTIFICATIONS
            </h2>
            <div className="profile-edit-page__toggles">
              {NOTIFICATION_PREFS.map((pref) => {
                const on = notificationPrefEnabled(form.notification_prefs, pref.key);
                return (
                  <div key={pref.key} className="profile-edit-page__toggle-row">
                    <span className="profile-edit-page__toggle-label">{pref.label}</span>
                    <button
                      type="button"
                      className={
                        on
                          ? "profile-edit-page__switch profile-edit-page__switch--on"
                          : "profile-edit-page__switch"
                      }
                      role="switch"
                      aria-checked={on}
                      aria-label={pref.label}
                      onClick={() => toggleNotification(pref.key)}
                    >
                      <span className="profile-edit-page__switch-knob" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className="profile-edit-page__card"
            aria-labelledby="profile-edit-privacy-heading"
          >
            <h2 id="profile-edit-privacy-heading" className="profile-edit-page__section-title">
              PRIVACY
            </h2>
            <div className="profile-edit-page__toggles">
              <div className="profile-edit-page__toggle-row">
                <span className="profile-edit-page__toggle-label">
                  Show my profile to other members
                </span>
                <button
                  type="button"
                  className={
                    form.public_profile
                      ? "profile-edit-page__switch profile-edit-page__switch--on"
                      : "profile-edit-page__switch"
                  }
                  role="switch"
                  aria-checked={form.public_profile}
                  aria-label="Show my profile to other members"
                  onClick={() => patchForm({ public_profile: !form.public_profile })}
                >
                  <span className="profile-edit-page__switch-knob" aria-hidden="true" />
                </button>
              </div>
              <div className="profile-edit-page__toggle-row">
                <span className="profile-edit-page__toggle-label">
                  Show my activity numbers on my profile
                </span>
                <button
                  type="button"
                  className={
                    form.stats_public
                      ? "profile-edit-page__switch profile-edit-page__switch--on"
                      : "profile-edit-page__switch"
                  }
                  role="switch"
                  aria-checked={form.stats_public}
                  aria-label="Show my activity numbers on my profile"
                  onClick={() => patchForm({ stats_public: !form.stats_public })}
                >
                  <span className="profile-edit-page__switch-knob" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <section
            className="profile-edit-page__card"
            aria-labelledby="profile-edit-account-heading"
          >
            <h2 id="profile-edit-account-heading" className="profile-edit-page__section-title">
              ACCOUNT
            </h2>
            <p className="profile-edit-page__hint">
              Email address and password are managed on your{" "}
              <Link to="/account">account page</Link>, where each change runs through
              its own confirmation flow.
            </p>
          </section>

          {saveError && (
            <p className="profile-edit-page__error" role="alert">
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
    </div>
  );
}
