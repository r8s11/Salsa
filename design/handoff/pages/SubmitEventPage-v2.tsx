import { useState } from "react";
import { Link } from "react-router-dom";
import HostEventForm, { EMPTY_DRAFT, EventDraft } from "../components/Host/HostEventForm";
import "./SubmitEventPage-v2.css";

/**
 * Community event submission — same form body as the host pages, but the
 * copy and the action row reflect that this goes through review.
 */
export default function SubmitEventPageV2() {
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [contact, setContact] = useState({ name: "", email: "", role: "" });
  const [submitted, setSubmitted] = useState(false);

  const addStyle = (label: string) => {
    setDraft((d) => ({ ...d, styles: { ...d.styles, [label]: true } }));
    setCustomStyles((c) => (c.includes(label) ? c : [...c, label]));
    setSubmitted(false);
  };

  const addTag = (label: string) => {
    setDraft((d) => ({ ...d, tags: { ...d.tags, [label]: true } }));
    setCustomTags((c) => (c.includes(label) ? c : [...c, label]));
    setSubmitted(false);
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

  if (submitted) {
    return (
      <div className="ss-page submit-v2__done">
        <div className="ss-eyebrow">Submitted</div>
        <h1 className="ss-h1">Thanks — it&apos;s in the queue.</h1>
        <p className="ss-lede">
          A moderator reviews every submission before it reaches the calendar, usually within a day.
          We&apos;ll email {contact.email || "you"} either way.
        </p>
        <div className="ss-row submit-v2__done-actions">
          <Link to="/calendar" className="ss-btn ss-btn--primary">
            Back to the calendar
          </Link>
          <button
            type="button"
            className="ss-btn ss-btn--ghost"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setCustomStyles([]);
              setCustomTags([]);
              setSubmitted(false);
            }}
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ss-page">
      <div>
        <div className="ss-eyebrow">Community submission</div>
        <h1 className="ss-h1">Add an event to the calendar</h1>
        <p className="ss-lede">
          Anyone can put a night forward. A moderator checks it before it goes live — the more you
          fill in, the faster that goes.
        </p>
      </div>

      <HostEventForm
        value={draft}
        onChange={setDraft}
        customStyles={customStyles}
        customTags={customTags}
        onAddStyle={addStyle}
        onAddTag={addTag}
        onRemoveStyle={removeStyle}
        onRemoveTag={removeTag}
      />

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Who&apos;s submitting</h2>
        <div className="ss-formrow">
          <label className="ss-field">
            <span className="ss-label">Your name *</span>
            <input
              className="ss-input"
              type="text"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
            />
          </label>
          <label className="ss-field">
            <span className="ss-label">Email *</span>
            <input
              className="ss-input"
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
          </label>
        </div>
        <label className="ss-field">
          <span className="ss-label">Your connection to the event</span>
          <select
            className="ss-select"
            value={contact.role}
            onChange={(e) => setContact({ ...contact, role: e.target.value })}
          >
            <option value="">Choose one…</option>
            <option value="organizer">I&apos;m the organizer</option>
            <option value="venue">I work at the venue</option>
            <option value="performer">I&apos;m performing or teaching</option>
            <option value="dancer">I&apos;m a dancer who spotted it</option>
          </select>
        </label>
        <span className="ss-hint">
          We only use this to follow up on the submission. It never shows on the public page.
        </span>
      </section>

      <div className="ss-card submit-v2__actions">
        <button type="button" className="ss-btn ss-btn--primary" onClick={() => setSubmitted(true)}>
          Submit for review
        </button>
        <Link to="/calendar" className="ss-btn ss-btn--ghost">
          Cancel
        </Link>
      </div>
    </div>
  );
}
