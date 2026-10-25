import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardShell from "../components/Dashboard/DashboardShell";
import HostEventForm, { EMPTY_DRAFT, EventDraft } from "../components/Host/HostEventForm";
import { HOST_RAIL } from "./HostDashboardPage-v2";
import "./HostEventEditPage-v2.css";

/** Stand-in for the fetched event — swap for your hook when wiring up. */
const SEEDS: Record<string, { status: string; draft: EventDraft }> = {
  "ev-havana": {
    status: "Live",
    draft: {
      ...EMPTY_DRAFT,
      title: "Havana Nights Social",
      type: "social",
      city: "boston",
      description:
        "The classic Cambridge Latin night: salsa, bachata, merengue and cha-cha until 1 AM. Live percussion sits in with the DJ for the midnight set.",
      styles: { ...EMPTY_DRAFT.styles, "Salsa On1": true, Bachata: true, "Cha-cha": true, Merengue: true },
      tags: { ...EMPTY_DRAFT.tags, "Live music": true, "Beginner friendly": true },
      date: "2026-10-24",
      time: "21:00",
      weekly: true,
      venue: "The Grand Ballroom",
      address: "288 Green St, Cambridge, MA",
      priceType: "paid",
      price: "15",
      rsvp: "https://www.instagram.com/SalsaSegura",
    },
  },
  "ev-gala": {
    status: "Draft",
    draft: {
      ...EMPTY_DRAFT,
      title: "Winter Salsa Gala",
      type: "social",
      city: "boston",
      description:
        "Black-tie-optional gala with two rooms, a live orchestra for the first set and a pro show at midnight. Room still being confirmed.",
      styles: { ...EMPTY_DRAFT.styles, "Salsa On1": true, Bachata: true },
      date: "2026-12-05",
      time: "20:00",
      priceType: "paid",
      price: "45",
    },
  },
};

export default function HostEventEditPageV2() {
  const { eventId = "ev-havana" } = useParams();
  const seed = SEEDS[eventId] ?? SEEDS["ev-havana"];

  const [draft, setDraft] = useState<EventDraft>(seed.draft);
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [saved, setSaved] = useState<null | "saved" | "draft">(null);
  const [askWithdraw, setAskWithdraw] = useState(false);

  const addStyle = (label: string) => {
    setDraft((d) => ({ ...d, styles: { ...d.styles, [label]: true } }));
    setCustomStyles((c) => (c.includes(label) ? c : [...c, label]));
    setSaved(null);
  };

  const addTag = (label: string) => {
    setDraft((d) => ({ ...d, tags: { ...d.tags, [label]: true } }));
    setCustomTags((c) => (c.includes(label) ? c : [...c, label]));
    setSaved(null);
  };

  const removeStyle = (label: string) => {
    setDraft((d) => {
      const styles = { ...d.styles };
      delete styles[label];
      return { ...d, styles };
    });
    setCustomStyles((c) => c.filter((x) => x !== label));
  };

  const removeTag = (label: string) => {
    setDraft((d) => {
      const tags = { ...d.tags };
      delete tags[label];
      return { ...d, tags };
    });
    setCustomTags((c) => c.filter((x) => x !== label));
  };

  return (
    <DashboardShell breadcrumb="Host · Edit Event" sections={HOST_RAIL}>
      <div className="ss-page">
        <div>
          <Link to="/host/events" className="ss-linkbtn">
            ← All my events
          </Link>
          <div className="host-edit__heading">
            <h1 className="ss-h1">Edit event</h1>
            <span className="ss-badge">{seed.status}</span>
          </div>
          <p className="ss-lede">
            Your changes go live as soon as you save. Withdraw the event to take it off the calendar.
          </p>
        </div>

        {saved && (
          <div className="ss-notice">
            <span aria-hidden="true">✓</span>
            <span>
              {saved === "draft"
                ? "Draft saved. It stays private until you publish it."
                : "Saved. Your changes are live."}
            </span>
          </div>
        )}

        <HostEventForm
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setSaved(null);
          }}
          customStyles={customStyles}
          customTags={customTags}
          onAddStyle={addStyle}
          onAddTag={addTag}
          onRemoveStyle={removeStyle}
          onRemoveTag={removeTag}
        />

        <div className="ss-card host-edit__actions">
          <div className="ss-row">
            <button type="button" className="ss-btn ss-btn--primary" onClick={() => setSaved("saved")}>
              Save changes
            </button>
            <button type="button" className="ss-btn ss-btn--ghost" onClick={() => setSaved("draft")}>
              Save draft
            </button>
            <Link to="/host/events" className="ss-btn ss-btn--ghost">
              Discard
            </Link>
          </div>

          {askWithdraw ? (
            <div className="ss-row host-edit__withdraw">
              <span className="ss-muted">Withdraw this event from the calendar?</span>
              <button type="button" className="ss-btn ss-btn--danger ss-btn--sm">
                Yes, withdraw
              </button>
              <button
                type="button"
                className="ss-btn ss-btn--ghost ss-btn--sm"
                onClick={() => setAskWithdraw(false)}
              >
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="ss-linkbtn" onClick={() => setAskWithdraw(true)}>
              Withdraw event
            </button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
