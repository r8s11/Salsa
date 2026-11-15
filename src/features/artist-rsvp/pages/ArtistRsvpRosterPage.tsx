import { useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../contexts/useAuth";
import WorkspaceFrame from "../../workspaces/components/WorkspaceFrame";
import AdminConfirmDialog from "../../admin/components/common/AdminConfirmDialog";
import EventShareControls from "../../events/components/EventShareControls";
import { buildPublicEventUrl } from "../../events/model/eventSharing";
import { ArtistRsvpError, removeArtistRsvp, updateArtistEvent, updateArtistRsvp } from "../api";
import { useArtistRoster, useRefreshArtistRsvp } from "../hooks";
import { countRoles, RSVP_ROLES, RSVP_ROLE_LABELS, type RsvpRow, type RsvpChanges } from "../model";
import "../artist-rsvp.css";

function SignupRow({ row, onSaved, onDenied, loadRow }: { row: RsvpRow; onSaved: () => Promise<unknown>; onDenied: () => void; loadRow: () => Promise<RsvpRow | undefined> }) {
  const id = useId();
  const [draft, setDraft] = useState(row);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const failed = (failure: unknown) => {
    if (failure instanceof ArtistRsvpError && failure.code === "42501") onDenied();
    if (failure instanceof ArtistRsvpError && failure.code === "40001") setStale(true);
    setError(failure instanceof Error ? failure.message : "We couldn’t change this signup. Please try again.");
  };
  const save = async (changes: RsvpChanges) => {
    if (busy || stale) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const updated = await updateArtistRsvp(draft.id, draft.version, changes);
      setDraft(updated);
      await onSaved();
      setMessage(changes.promote ? "Moved to the main list. Contact this guest manually; promotion does not send acceptance." : "Signup saved. Delivery status does not change saved acceptance.");
    } catch (failure) { failed(failure); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft.name.trim()) { setError("Enter a name."); e.currentTarget.querySelector<HTMLInputElement>("input")?.focus(); return; }
    void save({ name: draft.name, email: draft.email, role: draft.role, contacted: draft.contacted, confirmed: draft.confirmed });
  };
  const remove = async () => {
    if (busy || stale) return;
    setBusy(true); setError(null);
    try { await removeArtistRsvp(draft.id, draft.version); await onSaved(); setRemoving(false); }
    catch (failure) { failed(failure); setBusy(false); }
  };
  return <li className="artist-roster-row">
    <form onSubmit={submit} aria-label={`Signup for ${row.name}`}>
      <div className="artist-roster-fields">
        <label htmlFor={`${id}-name`}>Name<input id={`${id}-name`} value={draft.name} required maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label htmlFor={`${id}-email`}>Email<input id={`${id}-email`} value={draft.email} type="email" required maxLength={254} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
        <label htmlFor={`${id}-role`}>Dance role<select id={`${id}-role`} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as RsvpRow["role"] })}>{RSVP_ROLES.map((role) => <option key={role} value={role}>{RSVP_ROLE_LABELS[role]}</option>)}</select></label>
        <label className="artist-rsvp-check"><input type="checkbox" checked={draft.contacted} onChange={(e) => setDraft({ ...draft, contacted: e.target.checked })} />Contacted</label>
        <label className="artist-rsvp-check"><input type="checkbox" checked={draft.confirmed} disabled={draft.placement !== "main_list"} onChange={(e) => setDraft({ ...draft, confirmed: e.target.checked })} />Confirmed</label>
      </div>
      <p>{draft.placement === "main_list" ? "Main list" : "Waitlist"} · Email: {row.delivery ? `${row.delivery.status}${row.delivery.failure ? ` — ${row.delivery.failure}; needs attention` : ""}` : "No delivery recorded"}</p>
      {draft.confirmed && draft.email.trim().toLowerCase() !== row.email && <p>Correcting this email keeps acceptance and sends it to the new address. Delivered email cannot be recalled.</p>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="artist-rsvp-actions"><button className="admin-btn admin-btn--secondary" disabled={busy || stale} type="submit">{busy ? "Saving…" : "Save signup"}</button>{draft.placement === "waitlist" && <button className="admin-btn admin-btn--secondary" type="button" disabled={busy || stale} onClick={() => void save({ promote: true })}>Promote to main list</button>}<button className="admin-btn admin-btn--ghost" type="button" disabled={busy || stale} onClick={() => setRemoving(true)}>Remove signup</button>{stale && <button className="admin-btn admin-btn--secondary" type="button" onClick={async () => { setBusy(true); try { const current = await loadRow(); if (current) { setDraft(current); setStale(false); setError(null); setMessage("Current signup loaded. Review before changing it again."); } } catch (failure) { failed(failure); } finally { setBusy(false); } }}>Refresh and review signup</button>}</div>
    </form>
    {removing && <AdminConfirmDialog title="Remove this signup?" body="This frees a place without promoting anyone automatically. Removing a confirmed guest sends an acceptance withdrawal; it does not process a refund." confirmLabel="Remove signup" isBusy={busy} error={error} onConfirm={() => void remove()} onCancel={() => { if (!busy) setRemoving(false); }} />}
  </li>;
}

export default function ArtistRsvpRosterPage() {
  const { id = "", eventId = "" } = useParams();
  const { user } = useAuth();
  const query = useArtistRoster(eventId);
  const refresh = useRefreshArtistRsvp();
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const data = query.data;
  const base = `/host/instructors/${id}/events`;
  const authorized = !!user && !denied && !query.error && data?.event.artist_id === id;
  const close = async () => {
    if (!authorized || busy) return;
    setBusy(true); setError(null);
    try { await updateArtistEvent(eventId, { rsvp_closed: !data.event.rsvp_closed }); await refresh(); setMessage(data.event.rsvp_closed ? "New signups reopened." : "New signups closed. Existing records remain editable."); }
    catch (failure) { if (failure instanceof ArtistRsvpError && failure.code === "42501") setDenied(true); setError(failure instanceof Error ? failure.message : "We couldn’t change signup availability."); }
    finally { setBusy(false); }
  };
  return <WorkspaceFrame kind="instructor" id={id} section="RSVP roster">{() => <section className="artist-rsvp-operator">
    {!user || denied ? <p role="alert">Artist access denied. Sign in with an active artist owner or manager account.</p> : query.isPending ? <p role="status">Loading private RSVP roster…</p> : query.error ? <p role="alert">{query.error.message}</p> : !authorized ? <p role="alert">This artist cannot open this event’s roster.</p> : <div key={`${user.id}:${eventId}`}>
      <Link to={`${base}/${eventId}`}>← Edit event</Link>
      <header className="artist-rsvp-heading"><div><h2>{data.event.title} — RSVPs</h2><p>Private contacts · artist owners and managers only</p></div><button type="button" className="admin-btn admin-btn--secondary" disabled={busy} onClick={() => void close()}>{data.event.rsvp_closed ? "Reopen new signups" : "Close new signups"}</button></header>
      <p>{data.event.rsvp_closed ? "New signups closed. Your roster remains editable." : "New signups open."} Confirmed records the artist’s acceptance, not verified payment. Contacted is independent.</p>
      <p>Confirming or withdrawing acceptance sends a guest notice. Date/time changes notify current guests. Delivered email cannot be recalled.</p>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="artist-roster-summary" aria-label="Signup totals"><strong>{data.totals.main_list} main-list signups{data.event.rsvp_limit ? ` / ${data.event.rsvp_limit}` : ""}</strong><span>{data.totals.waitlist} waiting · {data.totals.confirmed} artist-confirmed</span><p>Signups do not verify payment or attendance, include unknown external sales, or define venue capacity.</p></div>
      {!data.rows.length ? <><h3>No signups yet</h3><p>Share your public event page to invite guests.</p><Link to={`/events/${data.event.slug || eventId}`}>View public event</Link><EventShareControls title={data.event.title} url={buildPublicEventUrl(data.event.slug || eventId)} /></> : ["main_list", "waitlist"].map((placement) => {
        const rows = data.rows.filter((row) => row.placement === placement);
        const raw = countRoles(rows); const confirmed = countRoles(rows, true);
        return <section key={placement} className="artist-roster-section" aria-label={placement === "main_list" ? "Main list" : "Waitlist"}>
          <h3>{placement === "main_list" ? "Main list" : "Waitlist"} · {rows.length}</h3>
          <p>Signups: {RSVP_ROLES.map((role) => `${RSVP_ROLE_LABELS[role]} ${raw[role]}`).join(" · ")}</p>
          <p>Artist-confirmed: {RSVP_ROLES.map((role) => `${RSVP_ROLE_LABELS[role]} ${confirmed[role]}`).join(" · ")}</p>
          {placement === "waitlist" && <p>Promote only when space is available, then contact the guest manually. Promotion does not confirm acceptance.</p>}
          <ul>{rows.map((row) => <SignupRow key={`${user.id}:${row.id}`} row={row} onSaved={refresh} onDenied={() => setDenied(true)} loadRow={async () => { const result = await query.refetch(); if (result.error) throw result.error; return result.data?.rows.find((item) => item.id === row.id); }} />)}</ul>
        </section>;
      })}
    </div>}
  </section>}</WorkspaceFrame>;
}
