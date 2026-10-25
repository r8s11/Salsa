import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "../components/Dashboard/DashboardShell";
import HostEventForm, { EMPTY_DRAFT, EventDraft } from "../components/Host/HostEventForm";
import { HOST_RAIL } from "./HostDashboardPage-v2";
import "./HostEventCreatePage-v2.css";

export default function HostEventCreatePageV2() {
  const [draft, setDraft] = useState<EventDraft>({
    ...EMPTY_DRAFT,
    tags: { ...EMPTY_DRAFT.tags, "Beginner friendly": true, "No partner needed": true },
  });
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [saved, setSaved] = useState<null | "published" | "draft">(null);

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
    <DashboardShell breadcrumb="Host · New Event" sections={HOST_RAIL}>
      <div className="ss-page">
        <div>
          <Link to="/host/events" className="ss-linkbtn">
            ← Cancel
          </Link>
          <div className="host-create__heading">
            <h1 className="ss-h1">Create event</h1>
            <span className="ss-badge">New · draft</span>
          </div>
          <p className="ss-lede">
            You publish your own events — no waiting on review. Save a draft if it is not ready yet.
          </p>
        </div>

        {saved && (
          <div className="ss-notice">
            <span aria-hidden="true">✓</span>
            <span>
              {saved === "draft"
                ? "Draft saved. It stays private until you publish it."
                : "Published. It is live on the calendar now."}
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

        <div className="ss-card host-create__actions">
          <button
            type="button"
            className="ss-btn ss-btn--primary"
            onClick={() => setSaved("published")}
          >
            Publish event
          </button>
          <button type="button" className="ss-btn ss-btn--ghost" onClick={() => setSaved("draft")}>
            Save draft
          </button>
          <Link to="/host/events" className="ss-btn ss-btn--ghost">
            Discard
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
