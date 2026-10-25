import { FormEvent, useState } from "react";
import "./HostEventForm.css";

export type EventDraft = {
  title: string;
  type: "social" | "class" | "workshop";
  city: "boston" | "new-york-city";
  description: string;
  styles: Record<string, boolean>;
  tags: Record<string, boolean>;
  date: string;
  time: string;
  weekly: boolean;
  venue: string;
  address: string;
  priceType: "free" | "paid";
  price: string;
  rsvp: string;
};

export const EMPTY_DRAFT: EventDraft = {
  title: "",
  type: "social",
  city: "boston",
  description: "",
  styles: {
    "Salsa On1": false,
    "Salsa On2": false,
    Bachata: false,
    "Bachata sensual": false,
    "Cha-cha": false,
    Kizomba: false,
    Merengue: false,
    Timba: false,
  },
  tags: {
    "Beginner friendly": false,
    "Live music": false,
    "No partner needed": false,
    "18+": false,
  },
  date: "",
  time: "21:00",
  weekly: false,
  venue: "",
  address: "",
  priceType: "paid",
  price: "",
  rsvp: "",
};

const CITIES: { id: EventDraft["city"]; label: string }[] = [
  { id: "boston", label: "Greater Boston" },
  { id: "new-york-city", label: "New York City" },
];

type Props = {
  value: EventDraft;
  onChange: (next: EventDraft) => void;
  /** Which chips the host added themselves — those get a remove affordance. */
  customStyles?: string[];
  customTags?: string[];
  onAddStyle?: (label: string) => void;
  onAddTag?: (label: string) => void;
  onRemoveStyle?: (label: string) => void;
  onRemoveTag?: (label: string) => void;
};

/**
 * The event form body, shared by Host · Create new Event and Host · Edit Event.
 * Pure local state — the wrapping page owns save/publish/withdraw.
 */
export default function HostEventForm({
  value,
  onChange,
  customStyles = [],
  customTags = [],
  onAddStyle,
  onAddTag,
  onRemoveStyle,
  onRemoveTag,
}: Props) {
  const [newStyle, setNewStyle] = useState("");
  const [newTag, setNewTag] = useState("");

  const set = <K extends keyof EventDraft>(key: K, v: EventDraft[K]) =>
    onChange({ ...value, [key]: v });

  const toggleIn = (group: "styles" | "tags", label: string) =>
    onChange({ ...value, [group]: { ...value[group], [label]: !value[group][label] } });

  const submitStyle = (e: FormEvent) => {
    e.preventDefault();
    const v = newStyle.trim();
    if (!v) return;
    onAddStyle?.(v);
    setNewStyle("");
  };

  const submitTag = (e: FormEvent) => {
    e.preventDefault();
    const v = newTag.trim();
    if (!v) return;
    onAddTag?.(v);
    setNewTag("");
  };

  const chipGroup = (
    group: "styles" | "tags",
    custom: string[],
    onRemove?: (label: string) => void
  ) => (
    <div className="ss-chips">
      {Object.keys(value[group]).map((label) => (
        <button
          key={label}
          type="button"
          className="ss-chip"
          aria-pressed={!!value[group][label]}
          onClick={() => toggleIn(group, label)}
        >
          {label}
          {custom.includes(label) && (
            <span
              className="ss-chip__x"
              role="button"
              aria-label={`Remove ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(label);
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="ss-stack">
      {/* ---------- details ---------- */}
      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Event details</h2>

        <label className="ss-field">
          <span className="ss-label">Event title *</span>
          <input
            className="ss-input"
            type="text"
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>

        <div className="ss-formrow">
          <label className="ss-field">
            <span className="ss-label">Type *</span>
            <select
              className="ss-select"
              value={value.type}
              onChange={(e) => set("type", e.target.value as EventDraft["type"])}
            >
              <option value="social">Social dance</option>
              <option value="class">Class</option>
              <option value="workshop">Workshop</option>
            </select>
          </label>

          <div className="ss-field">
            <span className="ss-label">City *</span>
            <div className="host-form__segmented">
              {CITIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="host-form__segmented-opt"
                  aria-pressed={value.city === c.id}
                  onClick={() => set("city", c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="host-form__media">
          <div className="ss-field">
            <span className="ss-label">Flyer</span>
            <div className="ss-dropzone host-form__flyer">Drop the flyer, or browse files</div>
          </div>
          <div className="ss-field host-form__cover-field">
            <span className="ss-label">Cover image</span>
            <div className="ss-dropzone host-form__cover">
              Wide cover for the event page, or browse files
            </div>
            <span className="ss-hint">
              The flyer shows in the feed and on the event page. The cover fills the top of the page
              — if you skip it, the flyer is used.
            </span>
          </div>
        </div>

        <label className="ss-field">
          <span className="ss-label">Description</span>
          <textarea
            className="ss-textarea"
            rows={4}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>

        <div className="ss-field">
          <span className="ss-label">Dance styles</span>
          {chipGroup("styles", customStyles, onRemoveStyle)}
          <form className="host-form__add" onSubmit={submitStyle}>
            <input
              className="ss-input"
              type="text"
              placeholder="Add another style…"
              value={newStyle}
              onChange={(e) => setNewStyle(e.target.value)}
            />
            <button type="submit" className="ss-btn ss-btn--danger ss-btn--sm">
              + Add style
            </button>
          </form>
        </div>

        <div className="ss-field">
          <span className="ss-label">Tags</span>
          {chipGroup("tags", customTags, onRemoveTag)}
          <form className="host-form__add" onSubmit={submitTag}>
            <input
              className="ss-input"
              type="text"
              placeholder="Beginner friendly, live band, rooftop…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />
            <button type="submit" className="ss-btn ss-btn--danger ss-btn--sm">
              + Add tag
            </button>
          </form>
          <span className="ss-hint">
            Tags show as filters on the calendar and help dancers find the night.
          </span>
        </div>
      </section>

      {/* ---------- when & where ---------- */}
      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">When &amp; where</h2>

        <div className="ss-formrow">
          <label className="ss-field">
            <span className="ss-label">Date *</span>
            <input
              className="ss-input"
              type="date"
              value={value.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span className="ss-label">Start time</span>
            <input
              className="ss-input"
              type="time"
              value={value.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          className="ss-toggle"
          aria-pressed={value.weekly}
          onClick={() => set("weekly", !value.weekly)}
        >
          <span className="ss-toggle__track">
            <span className="ss-toggle__knob" />
          </span>
          <span>
            <span className="ss-toggle__title">Repeats weekly</span>
            <span className="ss-toggle__meta">
              Currently: {value.weekly ? "Every week" : "One-off night"}
            </span>
          </span>
        </button>

        <div className="ss-formrow">
          <label className="ss-field">
            <span className="ss-label">Venue</span>
            <input
              className="ss-input"
              type="text"
              value={value.venue}
              onChange={(e) => set("venue", e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span className="ss-label">Address</span>
            <input
              className="ss-input"
              type="text"
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ---------- price & link ---------- */}
      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Price &amp; link</h2>

        <div className="ss-formrow">
          <div className="ss-field">
            <span className="ss-label">Entry</span>
            <div className="host-form__segmented">
              {(["free", "paid"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="host-form__segmented-opt"
                  aria-pressed={value.priceType === p}
                  onClick={() => set("priceType", p)}
                >
                  {p === "free" ? "Free" : "Paid"}
                </button>
              ))}
            </div>
          </div>

          {value.priceType === "paid" && (
            <label className="ss-field">
              <span className="ss-label">Door price (USD)</span>
              <input
                className="ss-input"
                type="number"
                min="0"
                value={value.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </label>
          )}
        </div>

        <label className="ss-field">
          <span className="ss-label">RSVP or ticket link</span>
          <input
            className="ss-input"
            type="url"
            value={value.rsvp}
            onChange={(e) => set("rsvp", e.target.value)}
          />
        </label>
      </section>
    </div>
  );
}
