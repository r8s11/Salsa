import "temporal-polyfill/global";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { databaseEventToScheduleX } from "../../events/model/convert";
import { EVENT_TYPE_LABELS, getEventTypes, type DatabaseEvent } from "../../events/model/types";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { ArtistRsvpError, submitGuestRsvp } from "../api";
import { usePublicArtistRsvp } from "../hooks";
import { RSVP_ROLES, RSVP_ROLE_LABELS, validArtistUrl, type GuestRsvpReceipt, type RsvpRole, type RsvpSummary } from "../model";
import "../artist-rsvp.css";

function Capture({ event, summary }: { event: DatabaseEvent; summary: RsvpSummary }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RsvpRole>("undecided");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<"name" | "email" | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [receipt, setReceipt] = useState<GuestRsvpReceipt | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (receipt) savedRef.current?.focus(); }, [receipt]);
  useEffect(() => { if (!retryAfter) return; const timer = window.setTimeout(() => setRetryAfter(0), retryAfter * 1000); return () => window.clearTimeout(timer); }, [retryAfter]);
  const schedule = databaseEventToScheduleX(event);
  const date = Temporal.PlainDateTime.from(schedule.start.replace(" ", "T")).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current || retryAfter || unavailable) return;
    setInvalid(null); setError(null);
    if (!name.trim() || name.trim().length > 120) { setInvalid("name"); setError("Enter your name (120 characters or fewer)."); nameRef.current?.focus(); return; }
    if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setInvalid("email"); setError("Enter a valid email address."); emailRef.current?.focus(); return; }
    inFlight.current = true; setBusy(true);
    try { setReceipt(await submitGuestRsvp({ event_id: event.id, name: name.trim(), email: email.trim(), role })); }
    catch (failure) {
      if (failure instanceof ArtistRsvpError) { setError(failure.message); if (failure.retryAfter) setRetryAfter(failure.retryAfter); if (failure.code === "unavailable") setUnavailable(true); }
      else setError("We couldn’t save your RSVP. Your details are still here. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  };
  const paid = event.price_type === "paid";
  const artistUrl = receipt?.external_url && validArtistUrl(receipt.external_url) ? receipt.external_url : null;
  return <div className="artist-public-grid">
    <section className="artist-public-context">
      <p className="artist-rsvp-eyebrow">{getEventTypes(event).map((type) => EVENT_TYPE_LABELS[type]).join(" · ")}</p>
      <h1>{event.title}</h1>
      <p>With <Link to={`/i/${summary.artist_slug}`}>{summary.artist_name}</Link></p>
      <div className="artist-public-meta"><time dateTime={event.event_date}>{date} · {schedule.timeZone}</time>{event.location && <p>{event.location}</p>}{event.address && <p>{event.address}</p>}</div>
      <div className="artist-public-count"><strong>{summary.main_list_count}{summary.rsvp_limit !== null ? ` / ${summary.rsvp_limit}` : ""}</strong><span>main-list signups, not confirmed attendance</span></div>
      <p className="artist-rsvp-muted">Signup counts do not verify payment or artist acceptance, include unknown external sales, or define venue capacity. Counts can change; they do not reserve a place.</p>
      <p>{summary.waitlist ? "The main list is full or waiting guests have priority. New requests join the waitlist." : "The artist manages admission. Overflow joins the waitlist; acceptance is a separate decision."}</p>
      <Link to={`/events/${event.slug || event.id}`}>← Event details</Link>
    </section>
    <section className="artist-public-form">
      {receipt ? <div className="artist-rsvp-saved"><p className="artist-rsvp-eyebrow">Information saved</p><h2 ref={savedRef} tabIndex={-1}>{paid ? "RSVP saved. Complete payment on the artist’s site." : "RSVP saved."}</h2><p>Check your email for main-list or waitlist status. Signup is not artist acceptance or verified payment.</p><div className="artist-rsvp-notice"><strong>No place is confirmed by this link.</strong><p>If you are waitlisted or unsure, contact {summary.artist_name} before paying. The artist handles admission and external payments.</p></div>{artistUrl && <a className="btn-primary" href={artistUrl} target="_blank" rel="noopener noreferrer">{paid ? "Continue to artist payment" : "Continue to artist site"}</a>}<p className="artist-rsvp-muted">Email delivery may take time. The artist must confirm your acceptance separately.</p></div> : !summary.available || unavailable ? <><h2>New signups unavailable</h2><p>{summary.rsvp_closed ? "The artist has closed new signups." : "This event is not accepting new signups."} Existing guests can contact the artist.</p></> : <form onSubmit={submit} noValidate>
        <h2>Join the signup list</h2><p>No account needed.</p>
        <label htmlFor="guest-rsvp-name">Name *</label><input id="guest-rsvp-name" ref={nameRef} name="name" autoComplete="name" required maxLength={120} value={name} aria-invalid={invalid === "name" || undefined} aria-describedby={invalid === "name" ? "guest-rsvp-error" : undefined} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="guest-rsvp-email">Email *</label><input id="guest-rsvp-email" ref={emailRef} name="email" autoComplete="email" type="email" required maxLength={254} value={email} aria-invalid={invalid === "email" || undefined} aria-describedby={invalid === "email" ? "guest-rsvp-error" : undefined} onChange={(e) => setEmail(e.target.value)} />
        <fieldset className="artist-public-roles"><legend>Dance role *</legend>{RSVP_ROLES.map((value) => <label key={value}><input type="radio" name="dance-role" value={value} checked={role === value} onChange={() => setRole(value)} />{RSVP_ROLE_LABELS[value]}</label>)}</fieldset>
        <p className="artist-rsvp-disclosure">Your name, email and dance role are shared with {summary.artist_name}’s active owners and managers to manage this event and send signup, acceptance and event-update notices.</p>
        {error && <p id="guest-rsvp-error" role="alert" className="artist-rsvp-error">{error}{retryAfter ? ` Retry after ${retryAfter} seconds.` : ""}</p>}
        <button className="btn-primary" type="submit" disabled={busy || !!retryAfter}>{busy ? "Saving RSVP…" : "Save my RSVP"}</button>
        <p className="artist-rsvp-muted">{paid ? "Save your details first. Then continue to the artist’s site for payment." : "Saving your details does not confirm artist acceptance."}</p>
      </form>}
    </section>
  </div>;
}

export default function PublicArtistRsvpPage() {
  const { id = "" } = useParams();
  const query = usePublicArtistRsvp(id);
  useDocumentMeta({ title: query.data ? `RSVP · ${query.data.event.title}` : "Event RSVP", description: "Save your event RSVP with the managing artist. Signup and artist acceptance are separate.", robots: "noindex, follow" });
  return <section className="artist-public-rsvp">{query.isPending ? <div role="status" className="artist-public-loading"><h1>Loading event availability…</h1><p>Checking current signup count and artist details.</p></div> : query.error ? <div role="alert"><h1>We couldn’t load this event</h1><p>Try again to check current signup availability.</p><button className="btn-secondary" onClick={() => void query.refetch()}>Try again</button></div> : !query.data ? <div><h1>RSVP unavailable</h1><p>This event does not have an available website signup page.</p><Link to="/calendar">Browse events</Link></div> : <Capture key={query.data.event.id} event={query.data.event} summary={query.data.summary} />}</section>;
}
