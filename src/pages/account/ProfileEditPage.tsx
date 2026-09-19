import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import { useUpdateOwnProfile } from "../../features/account/hooks/useUpdateOwnProfile";
import { useProfileMedia } from "../../features/account/hooks/useProfileMedia";
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
import type { CropGeometry } from "../../features/account/api/profileMedia";
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
    instagram: instagramHandle(profile.instagram ?? ""),
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
function instagramHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "");
}

function instagramUrl(handle: string): string {
  return handle ? "https://instagram.com/" + handle : "";
}

function instagramLinkError(value: string): string | null {
  const handle = instagramHandle(value);
  if (handle.length === 0) return null;
  if (/\s/.test(handle)) return "No spaces allowed";
  if (handle.includes("/")) return "No slashes allowed";
  return null;
}

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
  const media = useProfileMedia(user?.id);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const displayNameId = useId();
  const displayNameErrorId = useId();
  const usernameId = useId();
  const usernameHelpId = useId();
  const avatarMediaErrorId = useId();
  const avatarMediaStatusId = useId();
  const coverMediaErrorId = useId();
  const coverMediaStatusId = useId();
  const coverLabelId = useId();
  const bioId = useId();
  const bioHintId = useId();
  const cityId = useId();
  const instagramId = useId();
  const instagramErrorId = useId();
  const websiteId = useId();
  const websiteErrorId = useId();

  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);
  // The exact URL whose <img> raised onError. Comparing against the current
  // value means replacing the URL automatically re-attempts the load.
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const [failedCoverPreviewUrl, setFailedCoverPreviewUrl] = useState<string | null>(null);
  const avatarFocusRef = useRef<HTMLButtonElement>(null);
  const coverFocusRef = useRef<HTMLButtonElement>(null);
  const [searchParams] = useSearchParams();
  const focusTarget = searchParams.get("focus");

  // ── Avatar crop overlay ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCropUrl, setPendingCropUrl] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState(0);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [cropImgNatural, setCropImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [cropFillScale, setCropFillScale] = useState(1);
  const cropDragRef = useRef<{ startY: number; startOffset: number } | null>(null);

  // /profile puts "Change photo" and "Change cover" on the artwork itself and
  // links here with ?focus=. Landing on the matching field — rather than at
  // the top of a long form — is what makes those controls feel direct.
  const formReady = form !== null;
  useEffect(() => {
    if (!formReady || (focusTarget !== "photo" && focusTarget !== "cover")) return;
    const field = focusTarget === "cover" ? coverFocusRef.current : avatarFocusRef.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusTarget, formReady]);

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

  const instagramError = form ? instagramLinkError(form.instagram) : null;
  const websiteError = form ? linkError(form.website) : null;

  const dirty =
    form !== null &&
    profile !== null &&
    (form.display_name !== (profile.display_name ?? "") ||
      form.avatar_url !== (profile.avatar_url ?? "") ||
      form.cover_url !== (profile.cover_url ?? "") ||
      form.bio !== (profile.bio ?? "") ||
      form.city !== (profile.city ?? "") ||
      form.instagram !== instagramHandle(profile.instagram ?? "") ||
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
    !media.avatar.isBusy &&
    !media.cover.isBusy &&
    form !== null &&
    profile !== null &&
    dirty &&
    form.display_name.trim().length > 0 &&
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
        instagram: form.instagram.trim() ? (form.instagram.trim().startsWith("https://") ? form.instagram.trim() : instagramUrl(form.instagram.trim())) : null,
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

  // Media uploads save ONLY their own column straight to the profile row
  // (never the rest of the form) and then sync the local form value so the
  // editor does not go dirty with a stale URL.
  const handleAvatarRemove = async () => {
    try {
      await media.avatar.remove();
      setFailedPreviewUrl(null);
      patchForm({ avatar_url: "" });
    } catch {
      // The hook already stores the readable message in media.avatar.error.
    }
  };

  const handleCoverFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await media.cover.upload(file);
      setFailedCoverPreviewUrl(null);
      patchForm({ cover_url: url });
    } catch {
      // The hook already stores the readable message in media.cover.error.
    }
  };

  const handleCoverRemove = async () => {
    try {
      await media.cover.remove();
      setFailedCoverPreviewUrl(null);
      patchForm({ cover_url: "" });
    } catch {
      // The hook already stores the readable message in media.cover.error.
    }
  };

  // ── Avatar crop handlers ──

  const AVATAR_CROP_SIZE = 240;

  const handleAvatarFileSelect = (file: File | undefined) => {
    if (!file) return;
    setPendingFile(file);
    setPendingCropUrl(URL.createObjectURL(file));
    setCropOffset(0);
    setCropImgNatural(null);
    setCropFillScale(1);
  };

  const handleAvatarCropConfirm = async () => {
    if (!pendingFile || !cropImgNatural) return;
    const file = pendingFile;
    const imgW = cropImgNatural.w;
    const imgH = cropImgNatural.h;
    const fillScale = cropFillScale;
    cancelCrop();

    // The visible crop window in source pixels.
    const cropSize = AVATAR_CROP_SIZE / fillScale;
    const centerX = (imgW - cropSize) / 2;
    const centerY = (imgH - cropSize) / 2;

    // maxOffset: how far (in display px) the image can be dragged from center.
    const displayH = imgH * fillScale;
    const maxOffset = Math.max(0, (displayH - AVATAR_CROP_SIZE) / 2);
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, cropOffset));

    const crop: CropGeometry = {
      sx: Math.max(0, centerX),
      sy: Math.max(0, Math.min(imgH - cropSize, centerY - clampedOffset * fillScale)),
      sw: cropSize,
      sh: cropSize,
    };

    try {
      const url = await media.avatar.upload(file, crop);
      setFailedPreviewUrl(null);
      patchForm({ avatar_url: url });
    } catch {
      // The hook already stores the readable message in media.avatar.error.
    }
  };

  const cancelCrop = () => {
    if (pendingCropUrl) URL.revokeObjectURL(pendingCropUrl);
    setPendingFile(null);
    setPendingCropUrl(null);
    setCropOffset(0);
    setCropImgNatural(null);
    setCropFillScale(1);
  };

  const onCropPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!cropContainerRef.current) return;
      e.preventDefault();
      cropContainerRef.current.setPointerCapture(e.pointerId);
      cropDragRef.current = { startY: e.clientY, startOffset: cropOffset };
    },
    [cropOffset],
  );

  const onCropPointerMove = useCallback((e: PointerEvent) => {
    if (!cropDragRef.current || !cropContainerRef.current) return;
    const dy = e.clientY - cropDragRef.current.startY;
    const imgH = cropImgNatural?.h ?? 0;
    const fillScale = cropFillScale;
    const displayH = imgH * fillScale;
    const maxOffset = Math.max(0, (displayH - AVATAR_CROP_SIZE) / 2);
    const raw = cropDragRef.current.startOffset + dy;
    setCropOffset(Math.max(-maxOffset, Math.min(maxOffset, raw)));
  }, [cropImgNatural, cropFillScale]);

  const onCropPointerUp = useCallback(() => {
    cropDragRef.current = null;
  }, []);

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
        <h1 className="profile-edit-page__h1">Edit profile</h1>
        <p className="profile-edit-page__lede">Update how you appear across SalsaSegura.</p>
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

          {/* Photos first, composed the way /profile renders them, so the
              cover and the avatar are judged against each other while you
              change them. */}
          <section
            className="profile-edit-page__card profile-edit-page__photos"
            aria-labelledby="profile-edit-photos-heading"
          >
            <h2 id="profile-edit-photos-heading" className="profile-edit-page__section-title">
              PHOTOS
            </h2>

            <div className="profile-edit-page__stage">
              <div className="profile-edit-page__cover-stage">
                {showCoverPreview ? (
                  <img
                    className="profile-edit-page__cover-preview"
                    src={trimmedCoverUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedCoverPreviewUrl(trimmedCoverUrl)}
                  />
                ) : (
                  <span className="profile-edit-page__cover-empty">
                    {trimmedCoverUrl.length > 0
                      ? "That cover image didn't load"
                      : "No cover photo yet"}
                  </span>
                )}
                <span className="profile-edit-page__cover-scrim" aria-hidden="true" />
              </div>

              <div className="profile-edit-page__stage-avatar">
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
                    <Camera size={22} />
                    <span className="profile-edit-page__avatar-initials">{initials}</span>
                  </span>
                )}
                <div className="profile-edit-page__media-controls">
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="profile-edit-page__visually-hidden"
                    aria-label="Choose a profile photo to upload"
                    tabIndex={-1}
                    disabled={media.avatar.isBusy}
                    onChange={(event) => {
                      handleAvatarFileSelect(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    ref={avatarFocusRef}
                    className="profile-edit-page__btn profile-edit-page__btn--outline"
                    disabled={media.avatar.isBusy || profile === null}
                    onClick={() => avatarFileRef.current?.click()}
                  >
                    {trimmedAvatarUrl ? "Replace photo" : "Upload photo"}
                  </button>
                  {trimmedAvatarUrl && (
                    <button
                      type="button"
                      className="profile-edit-page__btn profile-edit-page__btn--outline"
                      disabled={media.avatar.isBusy || profile === null}
                      onClick={() => void handleAvatarRemove()}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {media.avatar.isBusy && (
                  <p
                    id={avatarMediaStatusId}
                    className="profile-edit-page__hint"
                    role="status"
                  >
                    Uploading photo…
                  </p>
                )}
                {media.avatar.error && (
                  <p
                    id={avatarMediaErrorId}
                    className="profile-edit-page__error"
                    role="alert"
                  >
                    {media.avatar.error}
                  </p>
                )}
              </div>
            </div>

            <div className="profile-edit-page__photo-fields">
              <div className="profile-edit-page__field">
                <span className="profile-edit-page__label" id={coverLabelId}>
                  Cover photo
                </span>
                <p className="profile-edit-page__hint">
                  A wide image reads best — it is cropped to the banner above.
                </p>
                <div className="profile-edit-page__media-controls">
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="profile-edit-page__visually-hidden"
                    aria-label="Choose a cover photo to upload"
                    tabIndex={-1}
                    disabled={media.cover.isBusy}
                    onChange={(event) => {
                      void handleCoverFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    ref={coverFocusRef}
                    className="profile-edit-page__btn profile-edit-page__btn--outline"
                    disabled={media.cover.isBusy || profile === null}
                    aria-describedby={coverLabelId}
                    onClick={() => coverFileRef.current?.click()}
                  >
                    {trimmedCoverUrl ? "Replace cover" : "Upload cover"}
                  </button>
                  {trimmedCoverUrl && (
                    <button
                      type="button"
                      className="profile-edit-page__btn profile-edit-page__btn--outline"
                      disabled={media.cover.isBusy || profile === null}
                      onClick={() => void handleCoverRemove()}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {media.cover.isBusy && (
                  <p id={coverMediaStatusId} className="profile-edit-page__hint" role="status">
                    Uploading cover…
                  </p>
                )}
                {media.cover.error && (
                  <p id={coverMediaErrorId} className="profile-edit-page__error" role="alert">
                    {media.cover.error}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section
            className="profile-edit-page__card profile-edit-page__identity"
            aria-labelledby="profile-edit-identity-heading"
          >
            <h2 id="profile-edit-identity-heading" className="profile-edit-page__section-title">
              NAME
            </h2>

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
                type="text"
                value={form.instagram}
                onChange={(event) => patchForm({ instagram: event.target.value })}
                placeholder="@username"
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

      {/* ── Avatar crop overlay ── */}
      {pendingCropUrl && (
        <div className="profile-edit-page__crop-overlay" onMouseDown={cancelCrop}>
          <div
            ref={cropContainerRef}
            className="profile-edit-page__crop-container"
            onPointerDown={onCropPointerDown}
            onPointerMove={onCropPointerMove}
            onPointerUp={onCropPointerUp}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <img
              ref={cropImgRef}
              className="profile-edit-page__crop-img"
              src={pendingCropUrl}
              alt="Adjust your profile photo position"
              draggable={false}
              onPointerDown={(e) => e.stopPropagation()}
              onLoad={(e) => {
                const img = e.currentTarget;
                const nw = img.naturalWidth;
                const nh = img.naturalHeight;
                // fillScale makes the shorter dimension fill the container,
                // so the longer dimension overflows and can be dragged.
                const fs = Math.max(AVATAR_CROP_SIZE / nw, AVATAR_CROP_SIZE / nh);
                setCropImgNatural({ w: nw, h: nh });
                setCropFillScale(fs);
                img.style.width = `${nw * fs}px`;
                img.style.height = `${nh * fs}px`;
              }}
              style={{ transform: `translate(-50%, calc(-50% + ${cropOffset}px))` }}
            />
            <span className="profile-edit-page__crop-ring" aria-hidden="true" />
          </div>
          <p className="profile-edit-page__crop-hint">Drag to position your photo</p>
          <div className="profile-edit-page__crop-actions">
            <button
              type="button"
              className="profile-edit-page__btn profile-edit-page__btn--outline"
              onClick={cancelCrop}
            >
              Cancel
            </button>
            <button
              type="button"
              className="profile-edit-page__btn profile-edit-page__btn--primary"
              disabled={!cropImgNatural}
              onClick={() => void handleAvatarCropConfirm()}
            >
              Use This Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
