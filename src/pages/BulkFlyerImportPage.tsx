import { useEffect, useRef, useState, type Ref } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, ImagePlus } from "lucide-react";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import MarginMark from "../components/Desk/MarginMark";
import type { DeskState } from "../components/Desk/deskModel";
import type { EventTaxonomyTerm } from "../features/events/model/types";
import { useAuth } from "../contexts/useAuth";
import { useCity } from "../contexts/useCity";
import { useMetros } from "../features/metros/hooks/useMetros";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import { createOrganizerEvent } from "../features/host/api/organizerAccessRepo";
import { createEventAsAdmin } from "../features/events/api/eventsRepo";
import {
  removeEventFlyer,
  uploadEventFlyer,
  validateEventFlyer,
} from "../features/events/api/eventFlyers";
import {
  buildEmptyAdminForm,
  validateAdminEventForm,
} from "../features/admin/model/adminEventForm";
import { useActiveTaxonomyTerms } from "../features/admin/hooks/useAdminTaxonomy";
import {
  CAPABILITIES,
  draftToAdminPayload,
  draftToOrganizerCreatePayload,
  type EventFormDraft,
} from "../features/events/components/EventForm/types";
import EventForm from "../features/events/components/EventForm/EventForm";
import { extractEventFromFlyer } from "../features/flyer-extraction/client";
import { applyExtractionToDraft } from "../features/flyer-extraction/prefill";
import EntityReviewSection from "../features/entity-matching/EntityReviewSection";
import { reconcileEntities } from "../features/entity-matching/entityReviewClient";
import {
  extractionEntityCandidates,
  hasEntityCandidates,
  mergeEntityReview,
} from "../features/entity-matching/entityReview";
import type { EntityCandidates, EntityReview } from "../features/entity-matching/entityReview";
import {
  enrichExtractionWithReview,
  listReviewEntries,
  reviewFromCandidates,
  suppressAutoVenueLink,
  detachAutoVenueLink,
} from "../features/entity-matching/entityReviewState";
import "../components/Desk/desk.css";
import "./BulkFlyerImportPage.css";

type Props = { mode: "host" | "admin" };
type SaveIntent = "draft" | "publish";
type FlyerRow = {
  id: string;
  file: File;
  url: string | null;
  draft: EventFormDraft;
  state:
    | "processing"
    | "ready"
    | "validation-error"
    | "analysis-error"
    | "save-error"
    | "skipped"
    | "created";
  analyzed: boolean;
  reviewed: boolean;
  reviewWarnings: string[];
  error: string | null;
  saveIntent: SaveIntent | null;
  savedAs: SaveIntent | null;
};

/**
 * A flyer is only confirmable when it would also save. Checking here, at the
 * moment of confirmation, keeps one incomplete flyer from being discovered at
 * save time — where it used to abort the whole batch.
 */
function confirmationError(draft: EventFormDraft): string | null {
  return validateAdminEventForm(draft) ?? (draft.city ? null : "Choose a city.");
}

function rowStatus(row: FlyerRow): { mark: DeskState | null; label: string } {
  switch (row.state) {
    case "processing":
      return { mark: null, label: "Reading" };
    case "validation-error":
      return { mark: "killed", label: "Invalid file" };
    case "analysis-error":
      return { mark: "killed", label: "Analysis failed" };
    case "save-error":
      return { mark: "killed", label: "Save failed" };
    case "skipped":
      return { mark: null, label: "Skipped" };
    case "created":
      return row.savedAs === "publish"
        ? { mark: "set", label: "Published" }
        : { mark: "standing", label: "Draft saved" };
    case "ready":
      return row.reviewed
        ? { mark: "set", label: "Confirmed" }
        : { mark: "unset", label: "Needs review" };
  }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function BulkFlyerImportPage({ mode }: Props) {
  const { user, isAdmin } = useAuth();
  const { city } = useCity();
  const { metros } = useMetros();
  const { data: organizers = [], isLoading, error: organizerError, refetch } = useMyOrganizers();
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const attributes = useActiveTaxonomyTerms("event_attribute");
  const queryClient = useQueryClient();
  const manageable = organizers.filter(
    (organizer) =>
      organizer.organizerStatus === "active" &&
      (organizer.memberRole === "owner" || organizer.memberRole === "manager")
  );
  const [organizerId, setOrganizerId] = useState("");
  const selectedOrganizerId =
    organizerId || (manageable.length === 1 ? manageable[0].organizerId : "");
  const [rows, setRows] = useState<FlyerRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [savingIntent, setSavingIntent] = useState<SaveIntent | null>(null);
  const saving = savingIntent !== null;
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const temporaryUrls = useRef(new Set<string>());
  const mounted = useRef(true);
  const previousCandidates = useRef(new Map<string, EntityCandidates>());

  const taxonomyLoading = mode === "admin" && (danceStyles.isLoading || attributes.isLoading);
  const taxonomyFailed = mode === "admin" && (!!danceStyles.error || !!attributes.error);
  const organizerMissing = mode === "host" && !selectedOrganizerId;

  let readingCount = 0;
  let toReviewCount = 0;
  let confirmedCount = 0;
  let attentionCount = 0;
  let savedCount = 0;
  for (const row of rows) {
    if (row.state === "processing") readingCount++;
    else if (row.state === "ready" && row.reviewed) confirmedCount++;
    else if (row.state === "ready") toReviewCount++;
    else if (row.state === "created") savedCount++;
    else if (row.state !== "skipped") attentionCount++;
  }

  useEffect(() => {
    mounted.current = true;
    const urls = temporaryUrls.current;
    return () => {
      mounted.current = false;
      for (const url of urls) void removeEventFlyer(url).catch(() => undefined);
    };
  }, []);

  const updateRow = (id: string, change: Partial<FlyerRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  };

  /** Bring the detail back into view when a selection change happens below its top edge. */
  const revealDetail = () => {
    requestAnimationFrame(() => {
      const detail = detailRef.current;
      if (!detail || detail.getBoundingClientRect().top >= 0) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      detail.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    });
  };

  const analyze = async (row: FlyerRow) => {
    updateRow(row.id, { state: "processing", error: null, saveIntent: null });
    let url = row.url;
    try {
      if (!url) {
        const uploaded = await uploadEventFlyer({
          file: row.file,
          ownerId: user!.id,
          eventId: `${mode === "admin" ? "admin-draft" : "submission"}-${crypto.randomUUID()}`,
        });
        if (!mounted.current) {
          await removeEventFlyer(uploaded.url);
          return;
        }
        url = uploaded.url;
        temporaryUrls.current.add(url);
        updateRow(row.id, { url });
      }
      const extraction = await extractEventFromFlyer(url);
      if (!mounted.current) return;
      const candidates = extractionEntityCandidates(extraction);
      let incoming: EntityReview | null = null;
      let reconciliationWarning: string | null = null;
      if (hasEntityCandidates(candidates)) {
        try {
          incoming = await reconcileEntities(candidates);
        } catch {
          incoming = reviewFromCandidates(candidates);
          reconciliationWarning = "Entity lookup is unavailable. Candidates remain unresolved; review or search again before linking.";
        }
      }
      if (!mounted.current) return;
      const review = suppressAutoVenueLink(mergeEntityReview(
        row.draft.entity_review ?? null,
        previousCandidates.current.get(row.id) ?? null,
        incoming ?? reviewFromCandidates(candidates)
      ), row.draft);
      previousCandidates.current.set(row.id, candidates);
      const prefill = applyExtractionToDraft(
        enrichExtractionWithReview(extraction, review),
        { ...row.draft, image_url: url },
        metros,
        { preserveCity: row.analyzed }
      );
      prefill.draft.entity_review = listReviewEntries(review).length ? review : undefined;
      const prefilled = prefill.draft;
      const reviewWarnings = [
        ...(reconciliationWarning ? [reconciliationWarning] : []),
        ...(!extraction.title ? ["Title was not identified on the flyer; verify it."] : []),
        ...(!extraction.date ? ["Date was not identified on the flyer; verify it."] : []),
        ...(!extraction.event_type
          ? ["Event type was not identified on the flyer; choose one."]
          : []),
        ...(!extraction.venue_name ? ["Venue was not identified on the flyer; verify it."] : []),
        ...(!extraction.city
          ? ["City was not identified on the flyer; verify the selected city."]
          : prefill.skipped.includes("City")
            ? [`Could not match flyer city "${extraction.city}" to a supported city; verify the selected city.`]
            : []),
        ...prefill.skipped
          .filter((field) => field !== "City")
          .map((field) => `${field} could not be matched from the flyer; verify it.`),
      ];
      const draft =
        mode === "admin"
          ? {
              ...prefilled,
              taxonomy_term_ids: danceStyles.terms
                .filter((term) => prefilled.dance_styles.includes(term.slug))
                .map((term) => term.id),
            }
          : prefilled;
      updateRow(row.id, {
        draft,
        state: "ready",
        analyzed: true,
        reviewed: false,
        reviewWarnings,
      });
      setSelectedId((current) => current ?? row.id);
    } catch (cause) {
      if (mounted.current) {
        updateRow(row.id, {
          draft: url ? { ...row.draft, image_url: url } : row.draft,
          state: "analysis-error",
          error: cause instanceof Error ? cause.message : "Unable to analyze flyer.",
        });
      }
    }
  };

  const selectFiles = async (files: FileList | null) => {
    if (!files?.length || !user || processing || saving || taxonomyLoading || taxonomyFailed)
      return;
    setError(null);
    setSummary(null);
    setProcessing(true);
    const next: FlyerRow[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: null,
      draft: buildEmptyAdminForm(city ?? ""),
      state: "processing",
      analyzed: false,
      reviewed: false,
      reviewWarnings: [],
      error: null,
      saveIntent: null,
      savedAs: null,
    }));
    setRows((current) => [...current, ...next]);
    for (const row of next) {
      if (!mounted.current) break;
      const validationError = validateEventFlyer(row.file);
      if (validationError)
        updateRow(row.id, { state: "validation-error", error: validationError });
      else await analyze(row);
    }
    setProcessing(false);
  };

  const skip = async (row: FlyerRow) => {
    updateRow(row.id, { state: "skipped", reviewed: false, error: null });
    const next = rows.find(
      (candidate) => candidate.id !== row.id && candidate.state === "ready" && !candidate.reviewed
    );
    if (next) setSelectedId(next.id);
    if (row.url) {
      try {
        await removeEventFlyer(row.url);
        temporaryUrls.current.delete(row.url);
        updateRow(row.id, { url: null });
      } catch {
        // Keep the URL for best-effort cleanup on departure.
      }
    }
  };

  const confirm = (row: FlyerRow) => {
    if (row.reviewed) {
      updateRow(row.id, { reviewed: false });
      return;
    }
    const problem = confirmationError(row.draft);
    if (problem) {
      updateRow(row.id, { error: problem });
      return;
    }
    updateRow(row.id, { reviewed: true, error: null });
    const index = rows.findIndex((candidate) => candidate.id === row.id);
    const next = [...rows.slice(index + 1), ...rows.slice(0, index)].find(
      (candidate) => candidate.state === "ready" && !candidate.reviewed
    );
    if (next) {
      setSelectedId(next.id);
      revealDetail();
    }
  };

  const save = async (publish: boolean, retryRow?: FlyerRow) => {
    if (saving || !user || organizerMissing || taxonomyLoading || taxonomyFailed) return;
    setError(null);
    setSummary(null);
    const candidates = retryRow
      ? [retryRow]
      : rows.filter((row) => row.state === "ready" && row.reviewed);
    if (!candidates.length) {
      setError("Confirm at least one flyer before saving.");
      return;
    }
    const valid: FlyerRow[] = [];
    let needsDetails = 0;
    for (const row of candidates) {
      const problem = confirmationError(row.draft);
      if (!problem) {
        valid.push(row);
        continue;
      }
      needsDetails++;
      updateRow(row.id, { state: "ready", reviewed: false, error: problem, saveIntent: null });
      if (needsDetails === 1) setSelectedId(row.id);
    }
    const intent: SaveIntent = publish ? "publish" : "draft";
    setSavingIntent(intent);
    let created = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        if (mode === "host") {
          await createOrganizerEvent(
            selectedOrganizerId,
            draftToOrganizerCreatePayload(row.draft),
            publish
          );
        } else {
          await createEventAsAdmin(
            draftToAdminPayload(row.draft),
            { id: user.id, email: user.email ?? null },
            publish
          );
        }
        if (row.url) temporaryUrls.current.delete(row.url);
        updateRow(row.id, { state: "created", error: null, saveIntent: null, savedAs: intent });
        created++;
      } catch (cause) {
        failed++;
        updateRow(row.id, {
          state: "save-error",
          reviewed: false,
          error: cause instanceof Error ? cause.message : "Event could not be saved.",
          saveIntent: intent,
        });
      }
    }
    if (created) void queryClient.invalidateQueries({ queryKey: ["events"] });
    setSummary(
      [
        created || (!failed && !needsDetails)
          ? publish
            ? `${created} published`
            : plural(created, "draft saved", "drafts saved")
          : null,
        failed ? `${failed} failed` : null,
        needsDetails ? `${plural(needsDetails, "flyer needs", "flyers need")} details` : null,
      ]
        .filter(Boolean)
        .join(" · ") + "."
    );
    setSavingIntent(null);
  };

  const back = mode === "host" ? "/host/events" : "/admin/events";
  if (mode === "admin" && !isAdmin) return <p role="alert">Only admins can import flyers.</p>;
  if (mode === "host" && isLoading) return <p role="status">Checking organizer access…</p>;
  if (mode === "host" && organizerError)
    return (
      <div role="alert">
        Could not check organizer access.{" "}
        <button type="button" onClick={() => void refetch()}>
          Try Again
        </button>
      </div>
    );
  if (mode === "host" && !manageable.length)
    return <p>Only active organizer owners and managers can import flyers.</p>;

  const selected =
    rows.find((row) => row.id === selectedId) ??
    rows.find((row) => row.state === "ready" || row.state === "save-error") ??
    rows.find((row) => row.state !== "skipped" && row.state !== "created") ??
    rows[0];
  const uploadDisabled =
    processing || saving || !user || organizerMissing || taxonomyLoading || taxonomyFailed;
  const saveBlocked = saving || organizerMissing || taxonomyLoading || taxonomyFailed;
  const statusLine = saving
    ? savingIntent === "publish"
      ? `Publishing ${plural(confirmedCount, "event", "events")}…`
      : `Saving ${plural(confirmedCount, "draft", "drafts")}…`
    : organizerMissing
      ? "Choose an organizer before saving."
      : taxonomyLoading
        ? "Loading event tags…"
        : confirmedCount === 0
          ? readingCount
            ? `Reading ${plural(readingCount, "flyer", "flyers")}. Confirm one to save it.`
            : toReviewCount
              ? "Confirm a flyer to save it."
              : "Nothing left to save."
          : [
              `${confirmedCount} confirmed`,
              toReviewCount ? `${toReviewCount} to review` : null,
              readingCount ? `${readingCount} still reading` : null,
            ]
              .filter(Boolean)
              .join(" · ");

  return (
    <div className="bulk-flyers desk">
      <AdminPageHeader
        title="Import flyers"
        description="Upload multiple event flyers, correct the extracted details, then save drafts or publish."
        actions={
          <Link to={back} className="admin-btn admin-btn--secondary">
            Back to Events
          </Link>
        }
      />
      <section
        className={`admin-card bulk-flyers__intake${rows.length ? " is-compact" : ""}`}
        aria-label="Add flyers"
      >
        {mode === "host" && (
          <div className="bulk-flyers__organizer">
            <label htmlFor="bulk-organizer">Creating events for</label>
            {manageable.length === 1 ? (
              <strong>{manageable[0].organizerName}</strong>
            ) : (
              <select
                id="bulk-organizer"
                className="admin-select"
                value={selectedOrganizerId}
                onChange={(event) => setOrganizerId(event.target.value)}
                disabled={processing || saving}
              >
                <option value="">Choose an organizer</option>
                {manageable.map((organizer) => (
                  <option value={organizer.organizerId} key={organizer.organizerId}>
                    {organizer.organizerName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="bulk-flyers__drop" data-disabled={uploadDisabled || undefined}>
          <input
            id="bulk-flyer-files"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            aria-label="Flyer images"
            aria-describedby="bulk-flyer-hint"
            disabled={uploadDisabled}
            onChange={(event) => {
              void selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <ImagePlus aria-hidden="true" className="bulk-flyers__drop-icon" />
          <span className="bulk-flyers__drop-title">
            {processing
              ? `Reading ${plural(readingCount, "flyer", "flyers")}…`
              : rows.length
                ? "Add more flyers"
                : "Choose flyer images"}
          </span>
          <span id="bulk-flyer-hint" className="bulk-flyers__drop-hint">
            JPEG, PNG, or WebP, up to 5 MB each.
            <span className="bulk-flyers__drop-pointer"> You can also drop files here.</span>
          </span>
        </div>
        {taxonomyFailed && (
          <p role="alert" className="bulk-flyers__intake-alert">
            Unable to load event taxonomy. Retry after it is available.
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <section className="bulk-flyers__sheet" aria-labelledby="bulk-sheet-title">
          <div className="bulk-flyers__tally">
            <h2 id="bulk-sheet-title">{plural(rows.length, "flyer", "flyers")}</h2>
            <dl aria-label="Review progress">
              <div>
                <dt>To review</dt>
                <dd>{toReviewCount + readingCount}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{confirmedCount}</dd>
              </div>
              <div>
                <dt>Attention</dt>
                <dd>{attentionCount}</dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd>{savedCount}</dd>
              </div>
            </dl>
          </div>
          <ul className="bulk-flyers__frames" aria-label="Flyers to review">
            {rows.map((row) => {
              const status = rowStatus(row);
              return (
                <li key={row.id} data-state={row.state}>
                  <button
                    type="button"
                    className="bulk-flyers__frame"
                    aria-current={selected?.id === row.id ? "true" : undefined}
                    aria-label={`${row.file.name}: ${status.label}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="bulk-flyers__frame-art">
                      {row.url ? <img src={row.url} alt="" /> : <span aria-hidden="true" />}
                    </span>
                    <span className="bulk-flyers__frame-status">
                      {status.mark && <MarginMark state={status.mark} />}
                      <span>{status.label}</span>
                    </span>
                    <span className="bulk-flyers__frame-title">
                      {row.draft.title || row.file.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selected && (
        <FlyerDetail
          ref={detailRef}
          row={selected}
          mode={mode}
          saving={saving}
          danceStyles={danceStyles.terms}
          attributes={attributes.terms}
          onDraftChange={(draft) =>
            updateRow(selected.id, {
              draft: detachAutoVenueLink(selected.draft, draft),
              state: "ready",
              reviewed: false,
              error: null,
              saveIntent: null,
            })
          }
          onConfirm={() => confirm(selected)}
          onSkip={() => void skip(selected)}
          onRetryAnalysis={() => void analyze(selected)}
          onEnterManually={() =>
            updateRow(selected.id, {
              state: "ready",
              error: null,
              reviewed: false,
              reviewWarnings: ["Analysis failed; enter or verify event details manually."],
            })
          }
          onRetrySave={() => {
            if (selected.saveIntent) void save(selected.saveIntent === "publish", selected);
          }}
        />
      )}

      {rows.length > 0 && (
        <div className="bulk-flyers__bar" role="region" aria-label="Save confirmed flyers">
          <div className="bulk-flyers__bar-message">
            {error && <p role="alert">{error}</p>}
            <p role="status">{error ? "" : (summary ?? statusLine)}</p>
          </div>
          <div className="bulk-flyers__bar-actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              disabled={saveBlocked || confirmedCount === 0}
              onClick={() => void save(false)}
            >
              {savingIntent === "draft"
                ? "Saving…"
                : confirmedCount
                  ? `Save ${confirmedCount} as ${confirmedCount === 1 ? "draft" : "drafts"}`
                  : "Save as drafts"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={saveBlocked || confirmedCount === 0}
              onClick={() => void save(true)}
            >
              {savingIntent === "publish"
                ? "Publishing…"
                : confirmedCount
                  ? `Publish ${plural(confirmedCount, "event", "events")}`
                  : "Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type FlyerDetailProps = {
  ref: Ref<HTMLElement>;
  row: FlyerRow;
  mode: "host" | "admin";
  saving: boolean;
  danceStyles: EventTaxonomyTerm[];
  attributes: EventTaxonomyTerm[];
  onDraftChange: (draft: EventFormDraft) => void;
  onConfirm: () => void;
  onSkip: () => void;
  onRetryAnalysis: () => void;
  onEnterManually: () => void;
  onRetrySave: () => void;
};

function FlyerDetail({
  ref,
  row,
  mode,
  saving,
  danceStyles,
  attributes,
  onDraftChange,
  onConfirm,
  onSkip,
  onRetryAnalysis,
  onEnterManually,
  onRetrySave,
}: FlyerDetailProps) {
  const status = rowStatus(row);
  const editable = row.state === "ready" || row.state === "save-error";
  const skippable = editable || row.state === "validation-error" || row.state === "analysis-error";

  return (
    <section
      ref={ref}
      className="admin-card bulk-flyers__detail"
      aria-label={`Review ${row.file.name}`}
      data-state={row.state}
    >
      <figure className="bulk-flyers__evidence">
        {row.url ? (
          <img src={row.url} alt={`Flyer ${row.file.name}`} />
        ) : (
          <div className="bulk-flyers__evidence-blank">
            {row.state === "processing" ? "Uploading…" : "No preview"}
          </div>
        )}
        {row.url && (
          <figcaption>
            <a href={row.url} target="_blank" rel="noreferrer">
              Open full size
              <ExternalLink aria-hidden="true" />
            </a>
          </figcaption>
        )}
      </figure>

      <div className="bulk-flyers__work">
        <header className="bulk-flyers__detail-head">
          <div>
            <p className="bulk-flyers__file">{row.file.name}</p>
            <h2>{row.draft.title || "Untitled flyer"}</h2>
          </div>
          <p className="bulk-flyers__detail-state">
            {status.mark && <MarginMark state={status.mark} />}
            {status.label}
          </p>
        </header>

        {row.state === "processing" && (
          <p role="status" className="bulk-flyers__note">
            Reading the flyer. Its details will appear here to check.
          </p>
        )}

        {(row.state === "validation-error" || row.state === "analysis-error") && (
          <div className="bulk-flyers__note">
            <p role="alert">{row.error}</p>
            {row.state === "analysis-error" && row.url && (
              <div className="bulk-flyers__note-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={saving || row.state !== "analysis-error"}
                  onClick={onRetryAnalysis}
                >
                  Retry analysis
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={saving}
                  onClick={onEnterManually}
                >
                  Continue manually
                </button>
              </div>
            )}
          </div>
        )}

        {row.state === "skipped" && (
          <p className="bulk-flyers__note">Skipped. This flyer will not be imported.</p>
        )}

        {row.state === "created" && (
          <div className="bulk-flyers__note">
            <p>
              {row.savedAs === "publish"
                ? "Published. It is live on the calendar."
                : "Saved as a draft. Publish it from your events when it is ready."}
            </p>
            {row.error && <p role="alert">{row.error}</p>}
          </div>
        )}

        {editable && (
          <>
            {row.state === "save-error" && (
              <div className="admin-banner admin-banner--error bulk-flyers__save-error">
                <p role="alert">{row.error}</p>
                {row.saveIntent && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    disabled={saving}
                    onClick={onRetrySave}
                  >
                    Retry save
                  </button>
                )}
              </div>
            )}
            {row.reviewWarnings.length > 0 && (
              <div className="admin-banner admin-banner--warning" role="note">
                <strong>Check these details against the flyer:</strong>
                <ul>
                  {row.reviewWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <EventForm
              draft={row.draft}
              onChange={onDraftChange}
              capabilities={{
                ...CAPABILITIES[mode === "host" ? "organizerCreate" : "admin"],
                flyer: false,
              }}
              taxonomyTerms={
                mode === "admin" ? { danceStyles, attributes, archived: [] } : undefined
              }
            />
            {row.draft.entity_review && (
              <EntityReviewSection
                review={row.draft.entity_review}
                onChange={(entity_review) => onDraftChange({ ...row.draft, entity_review })}
                disabled={saving}
                mode={mode === "admin" ? "authorized" : "public"}
              />
            )}
          </>
        )}

        {(editable || skippable) && (
          <footer className="bulk-flyers__detail-foot">
            {editable && row.state === "ready" && row.error && (
              <p role="alert" className="bulk-flyers__confirm-error">
                {row.error}
              </p>
            )}
            {editable && (
              <button
                type="button"
                className={`admin-btn ${row.reviewed ? "admin-btn--secondary" : "admin-btn--primary"} bulk-flyers__confirm`}
                aria-pressed={row.reviewed}
                disabled={saving}
                onClick={onConfirm}
              >
                {row.reviewed && <Check aria-hidden="true" />}
                {row.reviewed ? "Details confirmed" : "Confirm details against flyer"}
              </button>
            )}
            {skippable && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost bulk-flyers__skip"
                disabled={saving}
                onClick={onSkip}
              >
                Skip this flyer
              </button>
            )}
          </footer>
        )}
      </div>
    </section>
  );
}
