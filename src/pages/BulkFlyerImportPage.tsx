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
  state: "processing" | "ready" | "error" | "skipped" | "created";
  reviewed: boolean;
  error: string | null;
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
    updateRow(row.id, { state: "processing", error: null });
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
      const prefilled = applyExtractionToDraft(
        extraction,
        { ...row.draft, image_url: url },
        metros
      ).draft;
      const draft =
        mode === "admin"
          ? {
              ...prefilled,
              taxonomy_term_ids: danceStyles.terms
                .filter((term) => prefilled.dance_styles.includes(term.slug))
                .map((term) => term.id),
            }
          : prefilled;
      updateRow(row.id, { draft, state: "ready", reviewed: row.reviewed });
    } catch (cause) {
      if (mounted.current) {
        updateRow(row.id, {
          state: "error",
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
      reviewed: false,
      error: null,
    }));
    setRows((current) => [...current, ...next]);
    setSelectedId((current) => current ?? next[0].id);
    for (const row of next) {
      if (!mounted.current) break;
      const validationError = validateEventFlyer(row.file);
      if (validationError) updateRow(row.id, { state: "error", error: validationError });
      else await analyze({ ...row, reviewed: row.id === (selectedId ?? next[0].id) });
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

  const save = async (publish: boolean) => {
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
    const candidates = rows.filter((row) => row.state === "ready" && row.reviewed);
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
        updateRow(row.id, { state: "created", error: warning });
        created++;
      } catch (cause) {
        failed++;
        updateRow(row.id, {
          state: "error",
          error: cause instanceof Error ? cause.message : "Event could not be saved.",
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

  const selected = rows.find((row) => row.id === selectedId && row.state === "ready");
  return (
    <div className="admin-shell bulk-flyers">
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
                        : row.state === "error"
                          ? "Needs attention"
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
                      onClick={() => {
                        setSelectedId(row.id);
                        updateRow(row.id, { reviewed: true });
                      }}
                    >
                      Review
                    </button>
                  )}
                  {row.state === "error" && row.url && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      disabled={processing || saving}
                      onClick={() => void analyze(row)}
                    >
                      Retry analysis
                    </button>
                  )}
                  {(row.state === "ready" || row.state === "error") && (
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
          {selected && (
            <section
              className="admin-card bulk-flyers__editor"
              aria-label={`Review ${selected.file.name}`}
            >
              <h2>Review {selected.file.name}</h2>
              <img
                src={selected.url ?? ""}
                alt={`Flyer ${selected.file.name}`}
                className="bulk-flyers__preview"
              />
              <EventForm
                draft={selected.draft}
                onChange={(draft) => updateRow(selected.id, { draft, reviewed: true })}
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
            {saving ? "Saving…" : "Save reviewed drafts"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving || processing || (mode === "host" && !selectedOrganizerId)}
            onClick={() => void save(true)}
          >
            {saving ? "Publishing…" : "Publish reviewed events"}
          </button>
        </div>
      )}
    </div>
  );
}
