import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
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
import "./BulkFlyerImportPage.css";

type Props = { mode: "host" | "admin" };
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
  saveIntent: "draft" | "publish" | null;
};

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  let analyzedCount = 0;
  let reviewedCount = 0;
  let failedCount = 0;
  let commitCount = 0;
  for (const row of rows) {
    if (row.analyzed) analyzedCount++;
    if (row.reviewed) reviewedCount++;
    if (
      row.state === "validation-error" ||
      row.state === "analysis-error" ||
      row.state === "save-error"
    )
      failedCount++;
    if (row.state === "ready" && row.reviewed) commitCount++;
  }
  const temporaryUrls = useRef(new Set<string>());
  const mounted = useRef(true);

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
      const prefill = applyExtractionToDraft(
        extraction,
        { ...row.draft, image_url: url },
        metros
      );
      const prefilled = prefill.draft;
      const reviewWarnings = [
        ...(!extraction.title ? ["Title was not identified on the flyer; verify it."] : []),
        ...(!extraction.date ? ["Date was not identified on the flyer; verify it."] : []),
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
    if (
      !files?.length ||
      !user ||
      processing ||
      saving ||
      (mode === "admin" &&
        (danceStyles.isLoading || attributes.isLoading || danceStyles.error || attributes.error))
    )
      return;
    setError(null);
    setSummary(null);
    setProcessing(true);
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: null,
      draft: buildEmptyAdminForm(city ?? ""),
      state: "processing" as const,
      analyzed: false,
      reviewed: false,
      reviewWarnings: [],
      error: null,
      saveIntent: null,
    }));
    setRows((current) => [...current, ...next]);
    setSelectedId((current) => current ?? next[0].id);
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
    updateRow(row.id, { state: "skipped" });
    if (row.url) {
      try {
        await removeEventFlyer(row.url);
        temporaryUrls.current.delete(row.url);
        updateRow(row.id, { url: null });
      } catch {
        // Keep the URL for best-effort cleanup on departure.
      }
    }
    if (selectedId === row.id)
      setSelectedId(
        rows.find((candidate) => candidate.id !== row.id && candidate.state === "ready")?.id ?? null
      );
  };

  const save = async (publish: boolean, retryRow?: FlyerRow) => {
    if (
      saving ||
      processing ||
      !user ||
      (mode === "host" && !selectedOrganizerId) ||
      (mode === "admin" &&
        (danceStyles.isLoading || attributes.isLoading || danceStyles.error || attributes.error))
    )
      return;
    setError(null);
    setSummary(null);
    const candidates = retryRow
      ? [retryRow]
      : rows.filter((row) => row.state === "ready" && row.reviewed);
    if (!candidates.length) {
      setError("Review at least one flyer before saving.");
      return;
    }
    for (const row of candidates) {
      const validationError = validateAdminEventForm(row.draft);
      if (validationError) {
        setSelectedId(row.id);
        setError(validationError);
        return;
      }
    }
    setSaving(true);
    let created = 0;
    let failed = 0;
    for (const row of candidates) {
      try {
        let warning: string | null = null;
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
            publish,
            (message) => {
              warning = message;
            }
          );
        }
        if (row.url) temporaryUrls.current.delete(row.url);
        updateRow(row.id, { state: "created", error: warning, saveIntent: null });
        created++;
      } catch (cause) {
        failed++;
        updateRow(row.id, {
          state: "save-error",
          error: cause instanceof Error ? cause.message : "Event could not be saved.",
          saveIntent: publish ? "publish" : "draft",
        });
      }
    }
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    setSummary(
      `${created} ${publish ? "published" : created === 1 ? "draft saved" : "drafts saved"}${failed ? `; ${failed} failed` : ""}.`
    );
    setSaving(false);
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
    rows.find(
      (row) => row.id === selectedId && (row.state === "ready" || row.state === "save-error")
    ) ?? rows.find((row) => row.state === "ready" || row.state === "save-error");
  return (
    <div className="bulk-flyers">
      <AdminPageHeader
        title="Import flyers"
        description="Upload multiple event flyers, correct the extracted details, then save drafts or publish."
        actions={
          <Link to={back} className="admin-btn admin-btn--secondary">
            Back to Events
          </Link>
        }
      />
      {mode === "host" && (
        <div className="admin-card bulk-flyers__organizer">
          <label htmlFor="bulk-organizer">Creating events for</label>
          {manageable.length === 1 ? (
            <strong>{manageable[0].organizerName}</strong>
          ) : (
            <select
              id="bulk-organizer"
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
      <div className="admin-card bulk-flyers__upload">
        <label htmlFor="bulk-flyer-files">Flyer images</label>
        <input
          id="bulk-flyer-files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={
            processing ||
            saving ||
            !user ||
            (mode === "host" && !selectedOrganizerId) ||
            (mode === "admin" &&
              (danceStyles.isLoading ||
                attributes.isLoading ||
                !!danceStyles.error ||
                !!attributes.error))
          }
          onChange={(event) => {
            void selectFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <p>JPEG, PNG, or WebP; up to 5 MB per image. Review each flyer before saving.</p>
        {mode === "admin" && (danceStyles.error || attributes.error) && (
          <p role="alert">Unable to load event taxonomy. Retry after it is available.</p>
        )}
      </div>
      {rows.length > 0 && (
        <div className="bulk-flyers__review">
          <div className="bulk-flyers__queue">
            <div
              className="bulk-flyers__progress"
              role="group"
              aria-label="Review progress"
            >
              <p>
                <span>Analyzed</span>
                <strong>{analyzedCount}</strong>
              </p>
              <p>
                <span>Reviewed</span>
                <strong>{reviewedCount}</strong>
              </p>
              <p>
                <span>Failed</span>
                <strong>{failedCount}</strong>
              </p>
            </div>
            <ul className="bulk-flyers__list" aria-label="Flyers to review">
            {rows.map((row) => (
              <li key={row.id} aria-label={row.file.name} className="admin-card">
                {row.url && <img src={row.url} alt="" className="bulk-flyers__thumb" />}
                <div>
                  <strong>{row.file.name}</strong>
                  <p>
                    {row.draft.title ||
                      (row.state === "processing" ? "Analyzing…" : "Event details needed")}
                  </p>
                  <small>
                    {row.state === "created"
                      ? "Saved"
                      : row.state === "skipped"
                        ? "Skipped"
                        : row.state === "processing"
                          ? "Analyzing"
                          : row.state === "validation-error"
                            ? "Invalid file"
                            : row.state === "analysis-error"
                              ? "Analysis failed"
                              : row.state === "save-error"
                                ? "Save failed"
                                : row.reviewed
                                  ? "Reviewed"
                                  : "Not reviewed"}
                  </small>
                  {row.error && <p role="alert">{row.error}</p>}
                </div>
                <div className="bulk-flyers__row-actions">
                  {row.state === "ready" && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      disabled={saving}
                      onClick={() => setSelectedId(row.id)}
                    >
                      Review
                    </button>
                  )}
                  {row.state === "analysis-error" && row.url && (
                    <>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        disabled={processing || saving}
                        onClick={() => void analyze(row)}
                      >
                        Retry analysis
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        disabled={saving}
                        onClick={() => {
                          setSelectedId(row.id);
                          updateRow(row.id, {
                            state: "ready",
                            error: null,
                            reviewed: false,
                            reviewWarnings: ["Analysis failed; enter or verify event details manually."],
                          });
                        }}
                      >
                        Continue manually
                      </button>
                    </>
                  )}
                  {row.state === "save-error" && row.saveIntent && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      disabled={saving}
                      onClick={() => {
                        setSelectedId(row.id);
                        void save(row.saveIntent === "publish", row);
                      }}
                    >
                      Retry save
                    </button>
                  )}
                  {(row.state === "ready" ||
                    row.state === "validation-error" ||
                    row.state === "analysis-error" ||
                    row.state === "save-error") && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      disabled={saving}
                      onClick={() => void skip(row)}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </li>
            ))}
            </ul>
          </div>
          {selected && (
            <section
              className="admin-card bulk-flyers__editor"
              aria-label={`Review ${selected.file.name}`}
            >
              <h2>Review {selected.file.name}</h2>
              <div className="bulk-flyers__editor-overview">
                <img
                  src={selected.url ?? ""}
                  alt={`Flyer ${selected.file.name}`}
                  className="bulk-flyers__preview"
                />
                <dl className="bulk-flyers__facts" aria-label="Selected event facts">
                  <div>
                    <dt>Event</dt>
                    <dd>{selected.draft.title || "Title needed"}</dd>
                  </div>
                  <div>
                    <dt>Date · time</dt>
                    <dd>
                      {selected.draft.event_date || "Date needed"}
                      {selected.draft.event_time && ` · ${selected.draft.event_time}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>{selected.draft.location || "Venue needed"}</dd>
                  </div>
                  <div>
                    <dt>City</dt>
                    <dd>
                      {metros.find((metro) => metro.slug === selected.draft.city)?.name ??
                        selected.draft.city}
                    </dd>
                  </div>
                </dl>
              </div>
              {selected.reviewWarnings.length > 0 && (
                <div className="admin-banner admin-banner--warning" role="note">
                  <strong>Check these details against the flyer:</strong>
                  <ul>
                    {selected.reviewWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <EventForm
                draft={selected.draft}
                onChange={(draft) =>
                  updateRow(selected.id, {
                    draft,
                    state: "ready",
                    reviewed: false,
                    error: null,
                    saveIntent: null,
                  })
                }
                capabilities={{
                  ...CAPABILITIES[mode === "host" ? "organizerCreate" : "admin"],
                  flyer: false,
                }}
                taxonomyTerms={
                  mode === "admin"
                    ? { danceStyles: danceStyles.terms, attributes: attributes.terms, archived: [] }
                    : undefined
                }
              />
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => updateRow(selected.id, { reviewed: true })}
              >
                {selected.reviewed ? "Details confirmed" : "Confirm details against flyer"}
              </button>
            </section>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="admin-banner admin-banner--error">
          {error}
        </p>
      )}
      {summary && (
        <p role="status" className="admin-banner">
          {summary}
        </p>
      )}
      {rows.some((row) => row.state === "ready") && (
        <div className="bulk-flyers__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            disabled={saving || processing || (mode === "host" && !selectedOrganizerId)}
            onClick={() => void save(false)}
          >
            {saving
              ? "Saving…"
              : `Save ${commitCount} reviewed ${commitCount === 1 ? "draft" : "drafts"}`}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving || processing || (mode === "host" && !selectedOrganizerId)}
            onClick={() => void save(true)}
          >
            {saving
              ? "Publishing…"
              : `Publish ${commitCount} reviewed ${commitCount === 1 ? "event" : "events"}`}
          </button>
        </div>
      )}
    </div>
  );
}
