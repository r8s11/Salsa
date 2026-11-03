import "temporal-polyfill/global";
import { useEffect, useId, useMemo, useReducer, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, Send, X } from "lucide-react";
import { useCity } from "../../../contexts/useCity";
import { fetchApprovedEventsByIds } from "../../events/api/eventsRepo";
import { itineraryErrorMessage, saveItinerary } from "../../itineraries/api/itinerariesRepo";
import ItineraryEventFinder from "../../itineraries/components/admin/ItineraryEventFinder";
import ItinerarySchedule, { ItineraryWarningSummary } from "../../itineraries/components/admin/ItinerarySchedule";
import ItinerarySharePanel from "../../itineraries/components/admin/ItinerarySharePanel";
import {
  ADMIN_ITINERARIES_KEY,
  adminItineraryKey,
  useItineraryDraft,
  useWeekEvents,
} from "../../itineraries/hooks/useItineraryQueries";
import {
  usePublishItinerary,
  type ItineraryPosterInputs,
  type PublishItineraryStatus,
} from "../../itineraries/hooks/usePublishItinerary";
import { buildSchedule, itineraryWarnings } from "../../itineraries/model/schedule";
import type { IsoWeekday, Itinerary, ItineraryDraft, ItineraryItem, ItineraryItemRole } from "../../itineraries/model/types";
import {
  danceNightOf,
  defaultWeekStart,
  formatWeekRange,
  itineraryTimeZone,
  weekStartFor,
} from "../../itineraries/model/week";
import { useActiveMetros, useMetroName } from "../../metros/hooks/useMetros";
import type { DatabaseEvent } from "../../../types/events";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import AdminToast from "../components/common/AdminToast";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import "./AdminItineraryEditorPage.css";

type NightOf = (eventId: string) => string | null;
type Words = "title" | "description" | "recommendations";
type Action =
  | { type: "saved"; id: string }
  | { type: "words"; field: Words; value: string }
  | { type: "city"; city: string }
  | { type: "week"; date: string }
  | { type: "add"; eventId: string; role: ItineraryItemRole; nightOf: NightOf }
  | { type: "toggleFeatured"; eventId: string; nightOf: NightOf }
  | { type: "move"; eventId: string; offset: -1 | 1; nightOf: NightOf }
  | { type: "note"; eventId: string; note: string }
  | { type: "remove"; eventId: string; nightOf: NightOf }
  | { type: "unfeatured"; weekday: IsoWeekday; on: boolean };

interface EditorState {
  draft: ItineraryDraft;
  /** The last saved draft; any difference is an unsaved change. */
  pristine: ItineraryDraft;
}

/** Per night: the featured pick at 0, then the alternatives in their rank order. */
function renumber(items: ItineraryItem[], nightOf: NightOf): ItineraryItem[] {
  const nights = new Map<string | null, ItineraryItem[]>();
  for (const item of items) nights.set(nightOf(item.eventId), [...(nights.get(nightOf(item.eventId)) ?? []), item]);
  const positions = new Map<string, number>();
  for (const night of nights.values()) {
    night
      .sort((a, b) => Number(b.role === "featured") - Number(a.role === "featured") || a.position - b.position)
      .forEach((item, index) => positions.set(item.eventId, index));
  }
  return items.map((item) => ({ ...item, position: positions.get(item.eventId)! }));
}

/** Featuring an event demotes the night's previous featured pick to an alternative. */
function feature(items: ItineraryItem[], eventId: string, nightOf: NightOf): ItineraryItem[] {
  const night = nightOf(eventId);
  return items.map((item) =>
    item.eventId === eventId
      ? { ...item, role: "featured" }
      : item.role === "featured" && nightOf(item.eventId) === night
        ? { ...item, role: "alternative" }
        : item
  );
}

function editItems(items: ItineraryItem[], action: Action): ItineraryItem[] {
  switch (action.type) {
    case "add": {
      const added = [...items, { eventId: action.eventId, role: "alternative" as const, position: Infinity, note: null }];
      return renumber(action.role === "featured" ? feature(added, action.eventId, action.nightOf) : added, action.nightOf);
    }
    case "toggleFeatured": {
      const featured = items.find((item) => item.eventId === action.eventId)?.role === "featured";
      const next = featured
        ? items.map((item) => (item.eventId === action.eventId ? { ...item, role: "alternative" as const } : item))
        : feature(items, action.eventId, action.nightOf);
      return renumber(next, action.nightOf);
    }
    case "move": {
      const night = action.nightOf(action.eventId);
      const ranked = items
        .filter((item) => item.role === "alternative" && action.nightOf(item.eventId) === night)
        .sort((a, b) => a.position - b.position);
      const at = ranked.findIndex((item) => item.eventId === action.eventId);
      const other = ranked[at + action.offset];
      if (!other) return items;
      const moved = ranked[at];
      return items.map((item) =>
        item.eventId === moved.eventId
          ? { ...item, position: other.position }
          : item.eventId === other.eventId
            ? { ...item, position: moved.position }
            : item
      );
    }
    case "note":
      return items.map((item) => (item.eventId === action.eventId ? { ...item, note: action.note || null } : item));
    case "remove":
      return renumber(items.filter((item) => item.eventId !== action.eventId), action.nightOf);
    default:
      return items;
  }
}

function reducer(state: EditorState, action: Action): EditorState {
  const draft = state.draft;
  switch (action.type) {
    case "saved": {
      const saved = { ...draft, id: action.id };
      return { draft: saved, pristine: saved };
    }
    case "words":
      return { ...state, draft: { ...draft, [action.field]: action.field === "title" ? action.value : action.value || null } };
    case "city":
      return { ...state, draft: { ...draft, city: action.city, timeZone: itineraryTimeZone(action.city) } };
    case "week":
      return weekStartFor(action.date) ? { ...state, draft: { ...draft, weekStart: weekStartFor(action.date) } } : state;
    case "unfeatured": {
      const days = draft.unfeaturedDays.filter((day) => day !== action.weekday);
      return { ...state, draft: { ...draft, unfeaturedDays: action.on ? [...days, action.weekday].sort() : days } };
    }
    default:
      return { ...state, draft: { ...draft, items: editItems(draft.items, action) } };
  }
}

function newDraft(city: string): ItineraryDraft {
  const timeZone = itineraryTimeZone(city);
  return {
    id: null,
    city,
    weekStart: defaultWeekStart(Temporal.Now.instant(), timeZone),
    timeZone,
    title: "",
    description: null,
    recommendations: null,
    unfeaturedDays: [],
    items: [],
  };
}

function rangeLabel(weekStart: string, timeZone: string): string {
  const day = (date: Temporal.PlainDate) =>
    `${date.toLocaleString("en-US", { weekday: "short" })} ${date.toLocaleString("en-US", { month: "short" })} ${date.day}`;
  const start = Temporal.PlainDate.from(weekStart);
  return `${day(start)} – ${day(start.add({ days: 6 }))} · ${timeZone}`;
}

/** `/admin/itineraries/new` and `/admin/itineraries/:id`. */
export default function AdminItineraryEditorPage() {
  const { id = null } = useParams();
  const { city } = useCity();
  const { itinerary, draft, loading, error } = useItineraryDraft(id);

  if (id && loading) return <p className="itinerary-editor__empty" role="status">Loading itinerary…</p>;
  if (id && (error || !draft)) {
    return (
      <p className="admin-banner admin-banner--error" role="alert">
        {error ?? "This itinerary doesn't exist."} <Link to="/admin/itineraries">Back to itineraries</Link>
      </p>
    );
  }
  return <ItineraryEditor key={id ?? "new"} initial={draft ?? newDraft(city ?? "")} itinerary={itinerary} />;
}

function ItineraryEditor({ initial, itinerary }: { initial: ItineraryDraft; itinerary: Itinerary | null }) {
  const formId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const metroName = useMetroName();
  const { activeMetros } = useActiveMetros();
  const { publish, refreshCard, status: publishStatus } = usePublishItinerary();
  const [{ draft, pristine }, dispatch] = useReducer(reducer, { draft: initial, pristine: initial });
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState<"save" | "publish" | "regenerate" | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(
    () => (location.state as { publishError?: string } | null)?.publishError ?? null
  );
  const [confirming, setConfirming] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  const [dropped, setDropped] = useState(
    () => (location.state as { dropped?: { title: string }[] } | null)?.dropped ?? []
  );

  const week = useWeekEvents(draft.city, draft.weekStart, draft.timeZone);
  const pickedIds = useMemo(() => draft.items.map((item) => item.eventId).sort(), [draft.items]);
  const picked = useQuery({
    queryKey: [...adminItineraryKey(draft.id ?? "new"), "events", pickedIds],
    queryFn: () => fetchApprovedEventsByIds(pickedIds),
    enabled: pickedIds.length > 0,
    placeholderData: keepPreviousData,
  });
  const eventsById = useMemo(
    () => {
      const pickedEvents = picked.data ?? [];
      const returned = new Set(pickedEvents.map((event) => event.id));
      const candidates = week.events.filter(
        (event) => !picked.data || picked.isPlaceholderData || !pickedIds.includes(event.id) || returned.has(event.id)
      );
      return new Map<string, DatabaseEvent>([...candidates, ...pickedEvents].map((event) => [event.id, event]));
    },
    [week.events, picked.data, picked.isPlaceholderData, pickedIds]
  );
  const schedule = useMemo(() => buildSchedule(draft, eventsById), [draft, eventsById]);
  const warnings = useMemo(() => itineraryWarnings(draft, eventsById), [draft, eventsById]);
  const scheduleLoading = week.loading || picked.isLoading || picked.isPlaceholderData;
  const blocked = Boolean(picked.error || week.error) || warnings.some((warning) => warning.blocking);
  const dirty = JSON.stringify(draft) !== JSON.stringify(pristine);
  const status = itinerary?.status ?? "draft";
  const published = status === "published";
  const cityName = metroName(draft.city);

  const nightOf: NightOf = (eventId) => {
    const event = eventsById.get(eventId);
    return event ? danceNightOf(event.event_date, draft.timeZone).toString() : null;
  };
  const inputs = useMemo<ItineraryPosterInputs>(
    () => ({ itinerary: draft, cityName, nights: schedule.nights }),
    [draft, cityName, schedule.nights]
  );
  // The live card shows the saved week, so a regenerate presses the saved draft.
  const savedInputs = useMemo<ItineraryPosterInputs>(
    () => ({ itinerary: pristine, cityName, nights: buildSchedule(pristine, eventsById).nights }),
    [pristine, cityName, eventsById]
  );
  const coverAt = itinerary?.coverGeneratedAt ? Date.parse(itinerary.coverGeneratedAt) : null;
  const cardOutdated =
    published &&
    !scheduleLoading &&
    (cardFailed ||
      coverAt === null ||
      savedInputs.nights.some((night) => night.featured && Date.parse(night.featured.event.updated_at) > coverAt));

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_ITINERARIES_KEY });

  /** Saves when needed and resolves to the itinerary id. */
  const persist = async (): Promise<string> => {
    if (draft.id && !dirty && !published) return draft.id;
    const savedId = await saveItinerary(draft);
    dispatch({ type: "saved", id: savedId });
    return savedId;
  };

  const regenerate = async (savedId: string, from: ItineraryPosterInputs) => {
    try {
      await refreshCard(savedId, from);
      setCardFailed(false);
    } catch {
      setCardFailed(true);
    }
    await refresh();
  };

  const save = async () => {
    if (!draft.city || !draft.title.trim()) {
      setSaveError(draft.city ? "Add a title before saving." : "Choose a city before saving.");
      return;
    }
    setBusy("save");
    setSaveError(null);
    try {
      const savedId = await persist();
      await refresh();
      if (published) await regenerate(savedId, inputs);
      setNotice({ message: published ? "Changes saved." : "Draft saved.", tone: "success" });
      if (!draft.id) navigate(`/admin/itineraries/${savedId}`, { replace: true });
    } catch (err) {
      setSaveError(itineraryErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmPublish = async () => {
    if (blocked || scheduleLoading) return;
    setBusy("publish");
    setPublishError(null);
    let savedId: string | null = null;
    try {
      savedId = await persist();
      await publish(savedId, inputs);
      await refresh();
      setConfirming(false);
      setNotice({ message: `Published ${draft.title}.`, tone: "success" });
      if (!draft.id) navigate(`/admin/itineraries/${savedId}`, { replace: true });
    } catch (err) {
      const message = itineraryErrorMessage(err);
      setPublishError(message);
      if (!draft.id && savedId) {
        await refresh();
        navigate(`/admin/itineraries/${savedId}`, { replace: true, state: { publishError: message } });
      }
    } finally {
      setBusy(null);
    }
  };

  const runRegenerate = async () => {
    if (!draft.id) return;
    setBusy("regenerate");
    await regenerate(draft.id, savedInputs);
    setBusy(null);
  };

  const cities = activeMetros.some((metro) => metro.slug === draft.city) || !draft.city
    ? activeMetros
    : [...activeMetros, { slug: draft.city, name: cityName }];
  const publishLabel: Record<PublishItineraryStatus, string> = {
    idle: "Saving…",
    rendering: "Rendering link card…",
    uploading: "Uploading link card…",
    publishing: "Publishing…",
    error: "Publishing…",
  };

  return (
    <div className="itinerary-editor">
      <AdminPageHeader
        title={draft.id ? draft.title || "Untitled itinerary" : "New itinerary"}
        description={`${cityName || "No city yet"} · ${formatWeekRange(draft.weekStart)} · ${published ? "Published" : status === "archived" ? "Archived" : "Draft"}${dirty ? " · Unsaved changes" : ""}`}
        actions={
          <>
            {draft.id && (
              <Link to={`/admin/itineraries/${draft.id}/preview`} target="_blank" rel="noopener" className="admin-btn admin-btn--ghost">
                <Eye size={16} aria-hidden="true" />
                Preview<span className="admin-visually-hidden"> (opens in a new tab)</span>
              </Link>
            )}
            <button
              type="button"
              className={`admin-btn ${published ? "admin-btn--primary" : "admin-btn--secondary"}`}
              disabled={busy !== null || status === "archived"}
              onClick={() => void save()}
            >
              {busy === "save" ? "Saving…" : published ? "Save changes" : "Save draft"}
            </button>
            {!published && (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busy !== null || blocked || scheduleLoading || draft.items.length === 0 || status === "archived"}
                onClick={() => {
                  setPublishError(null);
                  setConfirming(true);
                }}
              >
                <Send size={16} aria-hidden="true" />
                Publish
              </button>
            )}
          </>
        }
      />

      {status === "archived" && <p className="admin-banner">Archived itineraries can&apos;t be edited. Preview it instead.</p>}
      {saveError && <p className="admin-banner admin-banner--error" role="alert">{saveError}</p>}
      {picked.error && <p className="admin-banner admin-banner--error" role="alert">{picked.error.message}</p>}
      {cardOutdated && (
        <p className="admin-banner itinerary-editor__stale" role="status">
          <span>
            Link preview image is out of date —{" "}
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={busy !== null} onClick={() => void runRegenerate()}>
              {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
            </button>
          </span>
        </p>
      )}
      {dropped.length > 0 && (
        <div className="admin-banner itinerary-editor__dropped" role="status">
          <div>
            <p>
              {dropped.length === 1 ? "1 event from last week has no date next week" : `${dropped.length} events from last week have no date next week`}
            </p>
            <ul>
              {dropped.map((entry, index) => (
                <li key={`${entry.title}-${index}`}>{entry.title}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="admin-icon-btn" aria-label="Dismiss" onClick={() => setDropped([])}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="itinerary-editor__panes" role="group" aria-label="Editor view">
        {(["edit", "preview"] as const).map((option) => (
          <button key={option} type="button" aria-pressed={pane === option} onClick={() => setPane(option)}>
            {option === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <fieldset className="itinerary-editor__layout" data-pane={pane} disabled={busy !== null || status === "archived"}>
        <div className="itinerary-editor__main">
          <ItineraryWarningSummary schedule={schedule} warnings={warnings} />

          <section className="admin-card itinerary-editor__section" aria-labelledby={`${formId}-words`}>
            <h2 id={`${formId}-words`}>Week &amp; words</h2>
            <div className="itinerary-editor__when">
              <div className="admin-field">
                <label htmlFor={`${formId}-city`}>City</label>
                <div className="admin-select-wrap">
                  <select
                    id={`${formId}-city`}
                    className="admin-select"
                    value={draft.city}
                    disabled={published}
                    onChange={(event) => dispatch({ type: "city", city: event.target.value })}
                  >
                    {!draft.city && <option value="">Choose a city</option>}
                    {cities.map((metro) => (
                      <option key={metro.slug} value={metro.slug}>
                        {metro.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
              </div>
              <div className="admin-field">
                <label htmlFor={`${formId}-week`}>Week of</label>
                <input
                  id={`${formId}-week`}
                  type="date"
                  className="admin-input"
                  value={draft.weekStart}
                  disabled={published}
                  onChange={(event) => dispatch({ type: "week", date: event.target.value })}
                />
              </div>
            </div>
            <p className="itinerary-editor__range">{rangeLabel(draft.weekStart, draft.timeZone)}</p>
            {published && <p className="itinerary-editor__muted">Unpublish to change the city or week.</p>}
            <div className="admin-field">
              <label htmlFor={`${formId}-title`}>Title</label>
              <input
                id={`${formId}-title`}
                className="admin-input"
                value={draft.title}
                maxLength={120}
                required
                onChange={(event) => dispatch({ type: "words", field: "title", value: event.target.value })}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={`${formId}-intro`}>Introduction</label>
              <textarea
                id={`${formId}-intro`}
                className="admin-textarea"
                value={draft.description ?? ""}
                onChange={(event) => dispatch({ type: "words", field: "description", value: event.target.value })}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={`${formId}-recommendations`}>Recommendations</label>
              <textarea
                id={`${formId}-recommendations`}
                className="admin-textarea"
                value={draft.recommendations ?? ""}
                onChange={(event) => dispatch({ type: "words", field: "recommendations", value: event.target.value })}
              />
            </div>
          </section>

          <ItineraryEventFinder
            events={week.events}
            loading={week.loading}
            error={week.error}
            timeZone={draft.timeZone}
            nights={schedule.nights}
            items={draft.items}
            onAdd={(eventId, role) => dispatch({ type: "add", eventId, role, nightOf })}
          />

          <ItinerarySchedule
            schedule={schedule}
            warnings={warnings}
            loading={scheduleLoading}
            onToggleFeatured={(eventId) => dispatch({ type: "toggleFeatured", eventId, nightOf })}
            onMove={(eventId, offset) => dispatch({ type: "move", eventId, offset, nightOf })}
            onNote={(eventId, note) => dispatch({ type: "note", eventId, note })}
            onRemove={(eventId) => dispatch({ type: "remove", eventId, nightOf })}
            onUnfeatured={(weekday, on) => dispatch({ type: "unfeatured", weekday, on })}
          />
        </div>

        <aside className="itinerary-editor__aside" aria-label="Preview">
          <ItinerarySharePanel inputs={inputs} published={published} />
        </aside>
      </fieldset>

      {confirming && (
        <AdminConfirmDialog
          title={`Publish ${draft.title || "this itinerary"}?`}
          body={[
            "The week goes public at its link. The link preview image is generated and uploaded first.",
            ...(warnings.length > 0 ? [`Still flagged: ${warnings.map((warning) => warning.message).join("; ")}.`] : []),
          ].join(" ")}
          confirmLabel="Publish"
          busyLabel={publishLabel[publishStatus]}
          tone="neutral"
          isBusy={busy === "publish"}
          error={publishError}
          onConfirm={() => void confirmPublish()}
          onCancel={() => setConfirming(false)}
        />
      )}

      {notice && <AdminToast message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
