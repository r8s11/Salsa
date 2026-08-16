import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import { usePlatformSettings } from "../features/admin/hooks/usePlatformSettings";
import {
  eventDefaultsFrom,
  generalSettingsFrom,
  validateEventDefaults,
  validateGeneralSettings,
  type EventDefaultsForm,
  type FieldErrors,
  type GeneralSettingsForm,
  type PlatformSettings,
  type SubmissionAccessForm,
} from "../features/admin/model/platformSettings";
import type { PlatformSettingsUpdate } from "../features/admin/api/platformSettingsRepo";
import "./AdminSettingsPage.css";

type PendingSubmissionChange = {
  field: keyof SubmissionAccessForm;
  value: boolean;
} | null;

type SettingsCard = "general" | "defaults" | "submissions";
function formatChangedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function settingsErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Your changes were not saved.";
  return /permission|policy|row-level|rls|authorized/i.test(message)
    ? "Your changes were not saved. Your access may have changed; refresh and try again."
    : message;
}

function serverFieldErrors(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return {
    general: {
      ...(message.includes("platform_settings_name_check")
        ? { platform_name: "Platform name must be 2 to 80 characters." }
        : {}),
      ...(message.includes("platform_settings_site_url_check")
        ? { public_site_url: "Enter a valid HTTPS URL." }
        : {}),
      ...(message.includes("platform_settings_support_email_check")
        ? { support_email: "Enter a valid support email address." }
        : {}),
    },
    defaults: {
      ...(message.includes("platform_settings_city_check")
        ? { default_city: "Choose Boston or New York City." }
        : {}),
      ...(message.includes("platform_settings_duration_check")
        ? {
            default_event_duration_minutes:
              "Choose a duration from 30 minutes to 12 hours in 30-minute increments.",
          }
        : {}),
    },
  };
}

function cardChangedAt(settings: PlatformSettings, savedByCurrentUser: boolean) {
  return `Last changed ${formatChangedAt(settings.updated_at)}${savedByCurrentUser ? " by you" : ""}`;
}

export default function AdminSettingsPage() {
  const { settings, isLoading, error, refetch, update } = usePlatformSettings();
  const [general, setGeneral] = useState<GeneralSettingsForm | null>(null);
  const [defaults, setDefaults] = useState<EventDefaultsForm | null>(null);
  const [generalErrors, setGeneralErrors] = useState<FieldErrors<GeneralSettingsForm>>({});
  const [defaultsErrors, setDefaultsErrors] = useState<FieldErrors<EventDefaultsForm>>({});
  const [generalSaveError, setGeneralSaveError] = useState<string | null>(null);
  const [defaultsSaveError, setDefaultsSaveError] = useState<string | null>(null);
  const [submissionSaveError, setSubmissionSaveError] = useState<string | null>(null);
  const [pendingSubmissionChange, setPendingSubmissionChange] =
    useState<PendingSubmissionChange>(null);
  const [savedCard, setSavedCard] = useState<SettingsCard | null>(null);
  const [savingCards, setSavingCards] = useState<Record<SettingsCard, boolean>>({
    general: false,
    defaults: false,
    submissions: false,
  });
  const [submissionAnnouncement, setSubmissionAnnouncement] = useState("");
  const previousSettingsRef = useRef<PlatformSettings | null>(null);
  const liveRegionId = useId();
  const generalIsDirty =
    settings !== null &&
    general !== null &&
    (general.platform_name !== settings.platform_name ||
      general.public_site_url !== settings.public_site_url ||
      general.support_email !== settings.support_email);
  const defaultsAreDirty =
    settings !== null &&
    defaults !== null &&
    (defaults.default_city !== settings.default_city ||
      defaults.default_event_duration_minutes !== settings.default_event_duration_minutes);

  useEffect(() => {
    if (!settings) return;

    const previous = previousSettingsRef.current;
    setGeneral((current) => {
      const currentMatchesPrevious =
        previous !== null &&
        current?.platform_name === previous.platform_name &&
        current.public_site_url === previous.public_site_url &&
        current.support_email === previous.support_email;
      return current === null || currentMatchesPrevious ? generalSettingsFrom(settings) : current;
    });
    setDefaults((current) => {
      const currentMatchesPrevious =
        previous !== null &&
        current?.default_city === previous.default_city &&
        current.default_event_duration_minutes === previous.default_event_duration_minutes;
      return current === null || currentMatchesPrevious ? eventDefaultsFrom(settings) : current;
    });
    previousSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!generalIsDirty && !defaultsAreDirty) return;

    const beforeUnloadMessage = "You have unsaved settings changes.";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = beforeUnloadMessage;
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      const isCurrentDocument =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search;
      if (destination.origin !== window.location.origin || isCurrentDocument) return;

      if (!window.confirm(beforeUnloadMessage)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [defaultsAreDirty, generalIsDirty]);

  const setCardSaving = (card: SettingsCard, isSaving: boolean) => {
    setSavingCards((current) => ({ ...current, [card]: isSaving }));
  };

  const saveGeneral = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!general) return;
    const errors = validateGeneralSettings(general);
    setGeneralErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setGeneralSaveError(null);
    setCardSaving("general", true);
    try {
      const saved = await update.mutateAsync({
        platform_name: general.platform_name.trim(),
        public_site_url: general.public_site_url.trim(),
        support_email: general.support_email.trim(),
      });
      setGeneral(generalSettingsFrom(saved));
      setSavedCard("general");
    } catch (saveError) {
      const serverErrors = serverFieldErrors(saveError);
      if (Object.keys(serverErrors.general).length > 0) setGeneralErrors(serverErrors.general);
      else setGeneralSaveError(settingsErrorMessage(saveError));
    } finally {
      setCardSaving("general", false);
    }
  };

  const saveDefaults = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!defaults) return;
    const errors = validateEventDefaults(defaults);
    setDefaultsErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setDefaultsSaveError(null);
    setCardSaving("defaults", true);
    try {
      const saved = await update.mutateAsync(defaults);
      setDefaults(eventDefaultsFrom(saved));
      setSavedCard("defaults");
    } catch (saveError) {
      const serverErrors = serverFieldErrors(saveError);
      if (Object.keys(serverErrors.defaults).length > 0) setDefaultsErrors(serverErrors.defaults);
      else setDefaultsSaveError(settingsErrorMessage(saveError));
    } finally {
      setCardSaving("defaults", false);
    }
  };

  const confirmSubmissionChange = async () => {
    if (!pendingSubmissionChange) return;
    const changes: PlatformSettingsUpdate = {
      [pendingSubmissionChange.field]: pendingSubmissionChange.value,
    };
    setSubmissionSaveError(null);
    setCardSaving("submissions", true);
    try {
      setSubmissionAnnouncement(
        `${submissionConfirmLabel(pendingSubmissionChange)} ${
          pendingSubmissionChange.value ? "enabled" : "disabled"
        }`
      );
      await update.mutateAsync(changes);
      setSavedCard("submissions");
      setPendingSubmissionChange(null);
    } catch (saveError) {
      setSubmissionSaveError(settingsErrorMessage(saveError));
    } finally {
      setCardSaving("submissions", false);
    }
  };

  if (isLoading) {
    return (
      <section className="admin-page admin-settings" aria-busy="true">
        <AdminPageHeader title="Settings" description="Configure SalsaSegura platform behavior" />
        <div className="admin-settings__skeleton" />
        <div className="admin-settings__skeleton" />
        <div className="admin-settings__skeleton" />
      </section>
    );
  }

  if (error || !settings) {
    return (
      <section className="admin-page admin-settings">
        <AdminPageHeader title="Settings" description="Configure SalsaSegura platform behavior" />
        <div className="admin-card admin-settings__error" role="alert">
          <p>{error ?? "Platform settings are unavailable. Refresh and try again."}</p>
          <button
            className="admin-btn admin-btn--secondary"
            type="button"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!general || !defaults) {
    return (
      <section className="admin-page admin-settings" aria-busy="true">
        <AdminPageHeader title="Settings" description="Configure SalsaSegura platform behavior" />
        <div className="admin-settings__skeleton" />
        <div className="admin-settings__skeleton" />
        <div className="admin-settings__skeleton" />
      </section>
    );
  }

  const publicSuggestionsEnabled = settings.allow_public_event_suggestions;
  const registeredSubmissionsEnabled = settings.allow_registered_user_submissions;
  const submissionsOpen = publicSuggestionsEnabled || registeredSubmissionsEnabled;
  const isSavingSubmissions = savingCards.submissions;
  return (
    <section className="admin-page admin-settings">
      <AdminPageHeader title="Settings" description="Configure SalsaSegura platform behavior" />
      <p id={liveRegionId} className="admin-visually-hidden" aria-live="polite">
        {savedCard === "general"
          ? "General settings saved"
          : savedCard === "defaults"
            ? "Event defaults saved"
            : savedCard === "submissions"
              ? submissionAnnouncement
              : ""}
      </p>

      <nav className="admin-settings__nav" aria-label="Settings sections">
        <a href="#general">General</a>
        <a href="#event-defaults">Event defaults</a>
        <a href="#submissions">Submissions &amp; moderation</a>
      </nav>

      <label className="admin-settings__mobile-nav" htmlFor="settings-section-nav">
        Jump to section
        <select
          id="settings-section-nav"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) window.location.hash = event.target.value;
          }}
        >
          <option value="" disabled>
            Choose a section
          </option>
          <option value="general">General</option>
          <option value="event-defaults">Event defaults</option>
          <option value="submissions">Submissions &amp; moderation</option>
        </select>
      </label>

      <form
        id="general"
        className="admin-card admin-settings__card"
        onSubmit={saveGeneral}
        noValidate
      >
        <div className="admin-settings__card-header">
          <div>
            <h2>General</h2>
            <p>Recognizable platform identity and public address for runtime consumers.</p>
          </div>
        </div>
        <SettingsTextField
          label="Platform name"
          value={general.platform_name}
          error={generalErrors.platform_name}
          onChange={(platform_name) => setGeneral({ ...general, platform_name })}
        />
        <SettingsTextField
          label="Public site URL"
          type="url"
          value={general.public_site_url}
          error={generalErrors.public_site_url}
          onChange={(public_site_url) => setGeneral({ ...general, public_site_url })}
        />
        <SettingsTextField
          label="Support email"
          type="email"
          value={general.support_email}
          error={generalErrors.support_email}
          onChange={(support_email) => setGeneral({ ...general, support_email })}
        />
        {generalSaveError && (
          <p className="admin-field__error" role="alert">
            {generalSaveError}
          </p>
        )}
        {generalIsDirty && (
          <DirtyCardActions
            onDiscard={() => {
              setGeneral(generalSettingsFrom(settings));
              setGeneralErrors({});
              setGeneralSaveError(null);
            }}
          />
        )}
        <CardActions
          isSaving={savingCards.general}
          label="Save General settings"
          changedAt={cardChangedAt(settings, savedCard === "general")}
        />
      </form>

      <form
        id="event-defaults"
        className="admin-card admin-settings__card"
        onSubmit={saveDefaults}
        noValidate
      >
        <div className="admin-settings__card-header">
          <div>
            <h2>Event defaults</h2>
            <p>Defaults reduce repetitive entry; existing events remain unchanged.</p>
          </div>
        </div>
        <div className="admin-field">
          <label htmlFor="default-city">Default city</label>
          <select
            id="default-city"
            value={defaults.default_city}
            onChange={(event) =>
              setDefaults({
                ...defaults,
                default_city: event.target.value as EventDefaultsForm["default_city"],
              })
            }
            aria-describedby={defaultsErrors.default_city ? "default-city-error" : undefined}
          >
            <option value="boston">Boston</option>
            <option value="new-york-city">New York City</option>
          </select>
          {defaultsErrors.default_city && (
            <p id="default-city-error" className="admin-field__error" role="alert">
              {defaultsErrors.default_city}
            </p>
          )}
        </div>
        <ReadonlySetting label="Default country" value="United States (US)" />
        <ReadonlySetting label="Default time zone" value="America/New_York" />
        <ReadonlySetting label="Default locale" value="English (United States)" />
        <ReadonlySetting label="Default currency" value="USD" />
        <div className="admin-field">
          <label htmlFor="default-event-duration">Default event duration (minutes)</label>
          <input
            id="default-event-duration"
            type="number"
            min={30}
            max={720}
            step={30}
            value={defaults.default_event_duration_minutes}
            onChange={(event) =>
              setDefaults({
                ...defaults,
                default_event_duration_minutes: Number(event.target.value),
              })
            }
            aria-describedby={
              defaultsErrors.default_event_duration_minutes
                ? "default-event-duration-error"
                : undefined
            }
          />
          {defaultsErrors.default_event_duration_minutes && (
            <p id="default-event-duration-error" className="admin-field__error" role="alert">
              {defaultsErrors.default_event_duration_minutes}
            </p>
          )}
        </div>
        {defaultsSaveError && (
          <p className="admin-field__error" role="alert">
            {defaultsSaveError}
          </p>
        )}
        {defaultsAreDirty && (
          <DirtyCardActions
            onDiscard={() => {
              setDefaults(eventDefaultsFrom(settings));
              setDefaultsErrors({});
              setDefaultsSaveError(null);
            }}
          />
        )}
        <CardActions
          isSaving={savingCards.defaults}
          label="Save event defaults"
          changedAt={cardChangedAt(settings, savedCard === "defaults")}
        />
      </form>

      <section
        id="submissions"
        className="admin-card admin-settings__card"
        aria-labelledby="submission-access-heading"
      >
        <div className="admin-settings__card-header">
          <div>
            <h2 id="submission-access-heading">Submissions &amp; moderation</h2>
            <p>
              Controls are enforced at the database boundary and apply immediately after
              confirmation.
            </p>
          </div>
          <span
            className={`admin-settings__status ${submissionsOpen ? "admin-settings__status--open" : ""}`}
          >
            {submissionsOpen ? "Accepting submissions" : "Submissions closed"}
          </span>
        </div>
        <SubmissionSwitch
          label="Public event suggestions"
          description="Allow guests and magic-link submitters to suggest an event."
          checked={publicSuggestionsEnabled}
          disabled={isSavingSubmissions}
          onChange={(value) =>
            setPendingSubmissionChange({ field: "allow_public_event_suggestions", value })
          }
        />
        <SubmissionSwitch
          label="Registered-user submissions"
          description="Allow signed-in active users to submit an event."
          checked={registeredSubmissionsEnabled}
          disabled={isSavingSubmissions}
          onChange={(value) =>
            setPendingSubmissionChange({ field: "allow_registered_user_submissions", value })
          }
        />
        {submissionSaveError && (
          <p className="admin-field__error" role="alert">
            {submissionSaveError}
          </p>
        )}
        <p className="admin-settings__changed-at">
          {cardChangedAt(settings, savedCard === "submissions")}
        </p>
      </section>

      <section
        className="admin-card admin-settings__boundary"
        aria-labelledby="later-settings-heading"
      >
        <h2 id="later-settings-heading">Later settings</h2>
        <p>
          Organizer settings, branding, SEO &amp; sharing, localization, notifications, and advanced
          infrastructure remain deployment or product-workflow concerns until each has an
          enforceable contract.
        </p>
      </section>

      {pendingSubmissionChange && (
        <AdminConfirmDialog
          title={`${pendingSubmissionChange.value ? "Enable" : "Disable"} ${pendingSubmissionChange.field === "allow_public_event_suggestions" ? "public event suggestions" : "registered-user submissions"}?`}
          body={submissionConfirmationBody(
            pendingSubmissionChange,
            publicSuggestionsEnabled,
            registeredSubmissionsEnabled
          )}
          confirmLabel={submissionConfirmLabel(pendingSubmissionChange)}
          initialFocus="cancel"
          isBusy={isSavingSubmissions}
          tone={pendingSubmissionChange.value ? "neutral" : "danger"}
          error={submissionSaveError}
          onCancel={() => setPendingSubmissionChange(null)}
          onConfirm={confirmSubmissionChange}
        />
      )}
    </section>
  );
}

function SettingsTextField({
  label,
  type = "text",
  value,
  error,
  onChange,
}: {
  label: string;
  type?: "text" | "url" | "email";
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/ /g, "-");
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="admin-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ReadonlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-field">
      <span className="admin-settings__readonly-label">{label}</span>
      <p className="admin-settings__readonly-value">{value}</p>
    </div>
  );
}

function CardActions({
  isSaving,
  label,
  changedAt,
}: {
  isSaving: boolean;
  label: string;
  changedAt: string;
}) {
  return (
    <div className="admin-settings__actions">
      <button className="admin-btn admin-btn--primary" type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : label}
      </button>
      <p className="admin-settings__changed-at">{changedAt}</p>
    </div>
  );
}

function DirtyCardActions({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="admin-settings__dirty">
      <p>Unsaved changes</p>
      <button className="admin-btn admin-btn--secondary" type="button" onClick={onDiscard}>
        Discard changes
      </button>
    </div>
  );
}

function SubmissionSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = label
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/-$/, "");
  return (
    <div className="admin-settings__switch">
      <div>
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
        <small>Applies immediately after confirmation.</small>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function submissionConfirmLabel(change: NonNullable<PendingSubmissionChange>) {
  const audience =
    change.field === "allow_public_event_suggestions"
      ? "public suggestions"
      : "registered-user submissions";
  return `${change.value ? "Enable" : "Disable"} ${audience}`;
}

function submissionConfirmationBody(
  change: NonNullable<PendingSubmissionChange>,
  publicEnabled: boolean,
  registeredEnabled: boolean
) {
  const otherPathEnabled =
    change.field === "allow_public_event_suggestions" ? registeredEnabled : publicEnabled;
  const audience =
    change.field === "allow_public_event_suggestions"
      ? "Visitors and magic-link submitters"
      : "Signed-in active users";
  const action = change.value
    ? "will be able to submit events"
    : "will no longer be able to submit events";
  const otherPath =
    change.field === "allow_public_event_suggestions"
      ? "Registered-user submissions"
      : "Public event suggestions";
  return `${audience} ${action}. ${otherPath} remain${otherPathEnabled ? " enabled" : " disabled"}.`;
}
