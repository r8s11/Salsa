import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Camera } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import {
  setOnboardingProfile,
  markOnboardingComplete,
  checkUsernameAvailable,
} from "../../features/account/api/accountRepo";
import {
  validateProfileImage,
  uploadAvatarFile,
  profileMediaErrorMessage,
} from "../../features/account/api/profileMedia";
import { SAFE_NAME_FALLBACK } from "../../features/account/model/account";
import { CITY_LABEL } from "../../features/admin/model/eventsQuery";
import type { City } from "../../features/events/model/types";
import { isSafeInternalPath } from "../../lib/authDestination";
import "./OnboardingPage.css";

const BIO_MAX_LENGTH = 600;
const CITY_OPTIONS = Object.entries(CITY_LABEL) as [City, string][];
/** Same regex as profiles_username_format constraint. */
const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

type FormState = {
  display_name: string;
  username: string;
  city: City | "";
  bio: string;
  avatar_file: File | null;
};

const INITIAL_FORM: FormState = {
  display_name: "",
  username: "",
  city: "",
  bio: "",
  avatar_file: null,
};

type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "invalid"; message: string };

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useOwnProfile(user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo: string = (() => {
    const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    if (stateReturnTo && isSafeInternalPath(stateReturnTo)) return stateReturnTo;
    return "/profile";
  })();

  const displayNameId = useId();
  const displayNameErrorId = useId();
  const usernameId = useId();
  const usernameStatusId = useId();
  const cityId = useId();
  const cityErrorId = useId();
  const bioId = useId();
  const bioHintId = useId();
  const avatarUrlId = useId();
  const avatarErrorId = useId();

  const [form, setForm] = useState<FormState>(() => {
    const name = profile?.display_name ?? "";
    return {
      ...INITIAL_FORM,
      display_name: name && name !== SAFE_NAME_FALLBACK ? name : "",
    };
  });
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [failedAvatarPreviewUrl, setFailedAvatarPreviewUrl] = useState<string | null>(null);

  // Debounce ref for username availability check.
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect away if onboarding already completed.
  useEffect(() => {
    if (!profileLoading && profile?.onboarding_completed_at != null) {
      navigate(returnTo, { replace: true });
    }
  }, [profile, profileLoading, navigate, returnTo]);

  // Hydrate form display_name from profile once it arrives.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (profile && !hydratedRef.current) {
      hydratedRef.current = true;
      const name = profile.display_name ?? "";
      if (name && name !== SAFE_NAME_FALLBACK) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external → form hydration from React Query
        setForm((prev) => ({ ...prev, display_name: name }));
      }
    }
  }, [profile]);

  const patchForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  // ── Username validation & availability ───────────────────────────

  const handleUsernameChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9_]/g, "");
    patchForm({ username: cleaned });
    setFailedAvatarPreviewUrl(null);

    clearTimeout(usernameTimerRef.current ?? undefined);

    const trimmed = cleaned.trim();
    if (trimmed.length === 0) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameStatus({
        state: "invalid",
        message: "3-24 letters, numbers, or underscores.",
      });
      return;
    }

    const RESERVED = new Set([
      "admin",
      "moderator",
      "organizer",
      "salsa",
      "bachata",
      "salsasegura",
      "submit",
      "calendar",
      "profile",
      "account",
      "signin",
      "auth",
      "api",
      "about",
      "contact",
      "events",
    ]);
    if (RESERVED.has(trimmed.toLowerCase())) {
      setUsernameStatus({ state: "taken" });
      return;
    }

    setUsernameStatus({ state: "checking" });
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(trimmed);
        setUsernameStatus(available ? { state: "available" } : { state: "taken" });
      } catch {
        setUsernameStatus({ state: "idle" });
      }
    }, 400);
  };

  // ── Avatar file handling (optional) ──────────────────────────────

  const handleAvatarFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const validationError = validateProfileImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(objectUrl);
    setFailedAvatarPreviewUrl(null);
    patchForm({ avatar_file: file });
  };

  // ── Submit ───────────────────────────────────────────────────────

  const displayNameBlank = form.display_name.trim().length === 0;
  const avatarValid = !form.avatar_file || !validateProfileImage(form.avatar_file);
  const bioOverLimit = form.bio.length > BIO_MAX_LENGTH;
  const cityMissing = form.city === "";

  const canSubmit =
    !saving &&
    !skipping &&
    !displayNameBlank &&
    form.username.trim().length >= 3 &&
    USERNAME_RE.test(form.username.trim()) &&
    usernameStatus.state === "available" &&
    !cityMissing &&
    !bioOverLimit &&
    avatarValid;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSaving(true);
    setError(null);

    try {
      let avatarToSave: string | undefined;
      if (form.avatar_file) {
        try {
          avatarToSave = await uploadAvatarFile(form.avatar_file, user.id);
        } catch (uploadErr) {
          setError(profileMediaErrorMessage(uploadErr));
          setSaving(false);
          return;
        }
      }
      await setOnboardingProfile({
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase(),
        city: form.city as City,
        bio: form.bio.trim() || undefined,
        avatar_url: avatarToSave,
      });
      navigate(returnTo, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already taken/i.test(msg)) {
        setUsernameStatus({ state: "taken" });
        setError("That username is already taken.");
      } else if (/username.*required/i.test(msg)) {
        setError("Username is required.");
      } else if (/display name.*required/i.test(msg)) {
        setError("Display name is required.");
      } else if (/city.*required/i.test(msg)) {
        setError("Please choose a city.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      await markOnboardingComplete();
      navigate(returnTo, { replace: true });
    } catch {
      setError("Could not skip onboarding. Please try again.");
      setSkipping(false);
    }
  };

  // ── Rendering states ─────────────────────────────────────────────

  if (authLoading || profileLoading) {
    return (
      <div className="onboarding-page__skeleton" aria-busy="true">
        <p role="status" className="onboarding-page__visually-hidden">
          Loading…
        </p>
        <span className="onboarding-page__skel onboarding-page__skel--h1" aria-hidden="true" />
        <span className="onboarding-page__skel onboarding-page__skel--input" aria-hidden="true" />
        <span className="onboarding-page__skel onboarding-page__skel--input" aria-hidden="true" />
        <span className="onboarding-page__skel onboarding-page__skel--btn" aria-hidden="true" />
      </div>
    );
  }

  if (!user) return null;
  if (profile?.onboarding_completed_at != null) return null;

  const initials =
    form.display_name.trim().length > 0 ? form.display_name.trim()[0].toUpperCase() : "?";
  const trimmedBio = form.bio.trim();
  const showAvatarPreview = avatarPreviewUrl != null && !failedAvatarPreviewUrl;

  const usernameStatusText = (() => {
    switch (usernameStatus.state) {
      case "checking":
        return "Checking…";
      case "available":
        return `${form.username} is available`;
      case "taken":
        return "That username is already taken";
      case "invalid":
        return usernameStatus.message;
      default:
        return null;
    }
  })();

  const usernameStatusClass = (() => {
    switch (usernameStatus.state) {
      case "available":
        return "onboarding-page__username-status onboarding-page__username-status--available";
      case "taken":
      case "invalid":
        return "onboarding-page__username-status onboarding-page__username-status--taken";
      case "checking":
        return "onboarding-page__username-status onboarding-page__username-status--checking";
      default:
        return "onboarding-page__username-status";
    }
  })();

  const usernameDescribedBy = usernameStatus.state !== "idle" ? usernameStatusId : undefined;

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__intro">
        <span className="onboarding-page__eyebrow">Welcome to Salsa Segura</span>
        <h1 className="onboarding-page__h1">Set up your profile</h1>
        <p className="onboarding-page__lede">
          Tell the community who you are. You can always edit this later.
        </p>
      </header>

      {error && (
        <div className="onboarding-page__notice" role="alert">
          {error}
        </div>
      )}

      <form className="onboarding-page__card" onSubmit={handleSubmit} noValidate>
        {/* ── Avatar ─────────────────────────── */}
        <div className="onboarding-page__avatar-section">
          <div className="onboarding-page__avatar-ring">
            {showAvatarPreview ? (
              <img
                className="onboarding-page__avatar-img"
                src={avatarPreviewUrl!}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => avatarPreviewUrl && setFailedAvatarPreviewUrl(avatarPreviewUrl)}
              />
            ) : (
              <span className="onboarding-page__avatar-initials" aria-hidden="true">
                {initials}
              </span>
            )}
          </div>
          <label className="onboarding-page__avatar-btn" tabIndex={0}>
            <Camera size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
            {showAvatarPreview ? "Change photo" : "Add a photo"}
            <input
              id={avatarUrlId}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileInput}
              className="onboarding-page__visually-hidden"
              aria-describedby={avatarErrorId}
            />
          </label>
        </div>

        {/* ── Display name ───────────────────── */}
        <div className="onboarding-page__field">
          <label htmlFor={displayNameId} className="onboarding-page__label">
            Display name <span aria-hidden="true">*</span>
          </label>
          <input
            id={displayNameId}
            className="onboarding-page__input"
            type="text"
            required
            value={form.display_name}
            onChange={(e) => patchForm({ display_name: e.target.value })}
            placeholder="Your name"
            maxLength={80}
            autoComplete="name"
            aria-invalid={displayNameBlank ? true : undefined}
            aria-describedby={displayNameBlank ? displayNameErrorId : undefined}
          />
          {displayNameBlank && (
            <p id={displayNameErrorId} className="onboarding-page__error" role="alert">
              A display name is required.
            </p>
          )}
        </div>

        {/* ── Username ───────────────────────── */}
        <div className="onboarding-page__field">
          <label htmlFor={usernameId} className="onboarding-page__label">
            Username <span aria-hidden="true">*</span>
          </label>
          <div className="onboarding-page__username-row">
            <div className="onboarding-page__username-input-wrap">
              <input
                id={usernameId}
                className="onboarding-page__input"
                type="text"
                required
                value={form.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="DJSegura"
                maxLength={24}
                autoComplete="username"
                aria-invalid={
                  usernameStatus.state === "taken" || usernameStatus.state === "invalid"
                    ? true
                    : undefined
                }
                aria-describedby={usernameDescribedBy}
              />
            </div>
            {usernameStatusText && (
              <span
                id={usernameStatusId}
                className={usernameStatusClass}
                role="status"
                aria-live="polite"
              >
                {usernameStatusText}
              </span>
            )}
          </div>
          <p className="onboarding-page__hint">
            3–24 characters. Letters, numbers, and underscores only.
          </p>
        </div>

        {/* ── City ───────────────────────────── */}
        <div className="onboarding-page__field">
          <label htmlFor={cityId} className="onboarding-page__label">
            City <span aria-hidden="true">*</span>
          </label>
          <select
            id={cityId}
            className="onboarding-page__input"
            value={form.city}
            onChange={(e) => patchForm({ city: e.target.value as City | "" })}
            aria-invalid={cityMissing && error ? true : undefined}
            aria-describedby={cityMissing && error ? cityErrorId : undefined}
          >
            <option value="">Choose your city</option>
            {CITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {cityMissing && error && (
            <p id={cityErrorId} className="onboarding-page__error" role="alert">
              Please choose a city.
            </p>
          )}
        </div>

        {/* ── Bio ────────────────────────────── */}
        <div className="onboarding-page__field">
          <label htmlFor={bioId} className="onboarding-page__label">
            Bio
          </label>
          <textarea
            id={bioId}
            className="onboarding-page__textarea"
            rows={3}
            value={form.bio}
            maxLength={BIO_MAX_LENGTH}
            onChange={(e) => patchForm({ bio: e.target.value })}
            placeholder="A couple of lines about how you dance and where you're usually found."
            aria-describedby={bioHintId}
          />
          <p id={bioHintId} className="onboarding-page__hint">
            {trimmedBio.length} / {BIO_MAX_LENGTH} characters
          </p>
        </div>

        {/* ── Actions ────────────────────────── */}
        <div className="onboarding-page__actions">
          <button
            type="submit"
            className="onboarding-page__btn onboarding-page__btn--primary"
            disabled={!canSubmit}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            className="onboarding-page__btn onboarding-page__btn--skip"
            disabled={skipping || saving}
            onClick={handleSkip}
          >
            {skipping ? "Skipping…" : "Skip for now"}
          </button>
        </div>
      </form>
    </div>
  );
}
