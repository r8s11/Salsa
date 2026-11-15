import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../contexts/useAuth";
import { useCity } from "../../../contexts/useCity";
import WorkspaceFrame from "../../workspaces/components/WorkspaceFrame";
import EventForm, { CAPABILITIES, type EventFormDraft } from "../../events/components/EventForm";
import EventFlyersField from "../../events/components/EventFlyersField";
import EventResponsibilityChecklist from "../../events/components/EventResponsibilityChecklist";
import EventShareControls from "../../events/components/EventShareControls";
import { buildPublicEventUrl } from "../../events/model/eventSharing";
import { emptyEventResponsibilityAck, hasEventResponsibilityAck } from "../../events/model/eventResponsibility";
import { eventFlyerList, flyerPayload } from "../../events/model/eventFlyers";
import { uploadEventFlyers, removeEventFlyer } from "../../events/api/eventFlyers";
import { useHostFlyers, storedFlyerUrls, finalFlyerUrls } from "../../host/hooks/useHostFlyers";
import { buildAdminFormFromEvent, buildEmptyAdminForm } from "../../admin/model/adminEventForm";
import { createArtistEvent, publishArtistEvent, updateArtistEvent } from "../api";
import { useArtistEvent, useArtistEvents, useRefreshArtistRsvp } from "../hooks";
import { artistEventPayload, requiresArtistRsvp, validateArtistEvent, type ArtistEvent, type ArtistRsvpSettings as Settings } from "../model";
import ArtistRsvpSettings from "../components/ArtistRsvpSettings";
import "../artist-rsvp.css";

function Editor({ artistId, event, userId }: { artistId: string; event?: ArtistEvent; userId: string }) {
  const { city } = useCity();
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = useRefreshArtistRsvp();
  const [draft, setDraft] = useState<EventFormDraft>(() => event ? { ...buildAdminFormFromEvent(event), dance_styles: event.dance_styles ?? [] } : buildEmptyAdminForm(city ?? ""));
  const [settings, setSettings] = useState<Settings>(() => ({ rsvp_enabled: event?.rsvp_enabled ?? false, rsvp_closed: event?.rsvp_closed ?? false, rsvp_limit: event?.rsvp_limit ?? null }));
  const [ack, setAck] = useState(emptyEventResponsibilityAck);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(location.state?.flyerWarning ?? null);
  const flyers = useHostFlyers(event ? eventFlyerList(event) : []);
  const base = `/host/instructors/${artistId}/events`;
  const canPublish = !event || event.status === "draft";
  const updateDraft = (value: EventFormDraft) => {
    setDraft(value);
    if (requiresArtistRsvp(value)) setSettings((current) => ({ ...current, rsvp_enabled: true }));
  };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const publish = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "publish";
    const validation = validateArtistEvent(draft, settings);
    setError(null); setMessage(null);
    if (validation) { setError(validation); e.currentTarget.querySelector<HTMLInputElement>(!draft.title.trim() ? "#event-title" : !draft.event_date ? "#event-date" : "#artist-payment-link")?.focus(); return; }
    if (publish && !hasEventResponsibilityAck(ack)) { setError("Complete all three responsibility acknowledgements before publishing."); return; }
    setBusy(true);
    try {
      const kept = storedFlyerUrls(flyers.entries);
      const content = { ...draft, image_url: kept[0] ?? "", image_urls: kept };
      let eventId = event?.id;
      if (eventId) {
        await updateArtistEvent(eventId, artistEventPayload(content, settings, true));
        if (publish) await publishArtistEvent(eventId, ack);
      } else {
        eventId = await createArtistEvent(artistId, { ...artistEventPayload(content, settings), ...(publish ? { publication_ack: ack } : {}) }, publish);
      }
      let warning: string | null = null;
      let urls = kept;
      const files = flyers.entries.flatMap((entry) => entry.file ? [entry.file] : []);
      if (files.length) {
        try {
          const uploaded = await uploadEventFlyers({ files, ownerId: userId, eventId });
          const added = uploaded.map((item) => item.url);
          urls = finalFlyerUrls(flyers.entries, added);
          try { await updateArtistEvent(eventId, flyerPayload(urls)); }
          catch { await Promise.allSettled(added.map(removeEventFlyer)); urls = kept; warning = "Event saved, but we couldn’t attach the flyers. Add them again from this event."; }
        } catch { warning = "Event saved, but we couldn’t upload the flyers. Add them again from this event."; }
      }
      const removed = event ? eventFlyerList(event).filter((url) => !kept.includes(url)) : [];
      await Promise.allSettled(removed.map(removeEventFlyer));
      flyers.reset(urls);
      setDraft((value) => ({ ...value, image_urls: urls, image_url: urls[0] ?? "" }));
      await refresh();
      if (!event) navigate(`${base}/${eventId}`, { state: warning ? { flyerWarning: warning } : undefined });
      else setMessage(warning ?? (publish ? "Event published." : "Event saved."));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We couldn’t save this event. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className="artist-rsvp-operator">
    <Link to={base}>← Artist events</Link>
    <header className="artist-rsvp-heading"><div><h2>{event ? "Edit artist event" : "Create artist event"}</h2><p>{event?.status === "approved" ? "Published event" : "Private draft until you publish"}. One dated event; no recurring registration.</p></div>{event?.rsvp_enabled && <Link to={`${base}/${event.id}/rsvps`}>Manage RSVPs</Link>}</header>
    {error && <p role="alert" className="admin-banner admin-banner--error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={save} className="admin-card artist-event-editor" noValidate>
      <fieldset disabled={busy} className="artist-rsvp-fields">
        <EventForm draft={draft} onChange={updateDraft} capabilities={{ ...CAPABILITIES.organizerCreate, recurrence: false }} renderRsvpField={() => <ArtistRsvpSettings draft={draft} settings={settings} onChange={setSettings} hasSignups={(event?.rsvp_state_version ?? 0) > 0} onLinkChange={(link) => setDraft({ ...draft, rsvp_link: link })} />} renderFlyerField={() => <EventFlyersField items={flyers.items} onAddFiles={flyers.addFiles} onRemove={flyers.remove} onMove={flyers.move} disabled={busy} />} />
        {canPublish && <EventResponsibilityChecklist value={ack} onChange={setAck} disabled={busy} />}
        {event?.rsvp_enabled && <p>Date/time changes notify current guests. Cancellation withdraws artist acceptances. Delivered email cannot be recalled.</p>}
        <div className="artist-rsvp-actions"><button className="admin-btn admin-btn--secondary" type="submit" value="draft" disabled={busy}>{busy ? "Saving…" : event?.status === "approved" ? "Save changes" : "Save draft"}</button>{canPublish && <button className="admin-btn admin-btn--primary" type="submit" value="publish" disabled={busy || !hasEventResponsibilityAck(ack)}>Publish event</button>}</div>
      </fieldset>
    </form>
    {event?.status === "approved" && <><Link to={`/events/${event.slug || event.id}`}>View public event</Link><EventShareControls url={buildPublicEventUrl(event.slug || event.id)} title={event.title} location={event.location} /></>}
  </section>;
}

export default function ArtistEventEditorPage() {
  const { id = "", eventId = "" } = useParams();
  const { user } = useAuth();
  const detail = useArtistEvent(id, eventId);
  const list = useArtistEvents(eventId ? "" : id);
  const query = eventId ? detail : list;
  return <WorkspaceFrame kind="instructor" id={id} section={eventId ? "Edit event" : "Create event"}>{() => !user ? <p role="alert">Sign in again to open artist events.</p> : query.isPending ? <p role="status">Checking artist event access…</p> : query.error ? <p role="alert">{query.error.message}</p> : <Editor key={`${user.id}:${id}:${eventId}`} artistId={id} event={eventId ? detail.data : undefined} userId={user.id} />}</WorkspaceFrame>;
}
