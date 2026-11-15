import type { EventFormDraft } from "../../events/components/EventForm";
import { requiresArtistRsvp, type ArtistRsvpSettings as Settings } from "../model";

export default function ArtistRsvpSettings({ draft, settings, onChange, onLinkChange, hasSignups = false }: {
  draft: EventFormDraft; settings: Settings; onChange: (value: Settings) => void;
  onLinkChange: (link: string) => void; hasSignups?: boolean;
}) {
  const required = requiresArtistRsvp(draft);
  return <fieldset className="artist-rsvp-settings">
    <legend>Website-managed RSVPs</legend>
    <label className="artist-rsvp-check"><input type="checkbox" checked={settings.rsvp_enabled || required} disabled={required || hasSignups} onChange={(e) => onChange({ ...settings, rsvp_enabled: e.target.checked })} />Collect RSVPs on Salsa Segura</label>
    {required && <p>Workshops require website-managed RSVPs.</p>}
    {hasSignups && <p>Signups exist. Close new signups instead of disabling collection.</p>}
    {settings.rsvp_enabled && <>
      <label htmlFor="artist-rsvp-limit">Main-list signup limit (optional)</label>
      <input id="artist-rsvp-limit" type="number" min="1" step="1" value={settings.rsvp_limit ?? ""} onChange={(e) => onChange({ ...settings, rsvp_limit: e.target.value === "" ? null : Number(e.target.value) })} />
      <p>This counts main-list signups before acceptance, not payment, attendance, unknown external sales or venue capacity. Overflow joins the waitlist.</p>
      <label className="artist-rsvp-check"><input type="checkbox" checked={settings.rsvp_closed} onChange={(e) => onChange({ ...settings, rsvp_closed: e.target.checked })} />Close new signups</label>
      <p>Closing signups keeps your existing roster editable. Existing waiting guests take priority over newcomers.</p>
    </>}
    <label htmlFor="artist-payment-link">{settings.rsvp_enabled ? "Artist registration / payment link" : "RSVP link"}</label>
    <input id="artist-payment-link" type="url" value={draft.rsvp_link} onChange={(e) => onLinkChange(e.target.value)} />
    {settings.rsvp_enabled && <p>Choose Free or Paid above. Paid requires an HTTP(S) artist link. Guests see this link only after saving their RSVP. Salsa Segura does not process or verify payment.</p>}
  </fieldset>;
}
