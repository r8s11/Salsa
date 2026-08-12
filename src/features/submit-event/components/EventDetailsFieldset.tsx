import type { SubmitForm } from "../validation";

const DANCE_STYLE_OPTIONS = [
  { value: "salsa", label: "Salsa" },
  { value: "bachata", label: "Bachata" },
  { value: "kizomba", label: "Kizomba" },
  { value: "merengue", label: "Merengue" },
  { value: "cha-cha", label: "Cha-Cha" },
  { value: "zouk", label: "Zouk" },
  { value: "afro-cuban", label: "Afro-Cuban" },
] as const;

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string | string[]) => void;
}

export default function EventDetailsFieldset({ form, update }: Props) {
  return (
    <fieldset>
      <legend>Event Details</legend>

      <div className="form-group">
        <label htmlFor="title">Event Title *</label>
        <input
          id="title"
          type="text"
          placeholder="e.g. Friday Night Salsa Social"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="event_type">Event Type *</label>
          <select
            id="event_type"
            value={form.event_type}
            onChange={(e) => update("event_type", e.target.value)}
            required
          >
            <option value="">Select type</option>
            <option value="social">Social Dance</option>
            <option value="class">Class</option>
            <option value="workshop">Workshop</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="city">City *</label>
          <select
            id="city"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
          >
            <option value="boston">Boston</option>
            <option value="new-york-city">New York City</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="event_date">Date *</label>
          <input
            id="event_date"
            type="date"
            value={form.event_date}
            onChange={(e) => update("event_date", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="event_time">Start Time</label>
          <input
            id="event_time"
            type="time"
            value={form.event_time}
            onChange={(e) => update("event_time", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group form-group--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.recurrence === "weekly"}
            onChange={(e) => update("recurrence", e.target.checked ? "weekly" : "")}
          />
          This is a weekly recurring event
        </label>
      </div>

      <div className="form-group">
        <label>Dance Styles</label>
        <div className="form-dance-styles-grid">
          {DANCE_STYLE_OPTIONS.map((style) => {
            const checked = form.dance_styles.includes(style.value);
            return (
              <label key={style.value} className="form-dance-style-chip">
                <input
                  type="checkbox"
                  value={style.value}
                  checked={checked}
                  onChange={() => {
                    const current = form.dance_styles;
                    const updated = checked
                      ? current.filter((s) => s !== style.value)
                      : [...current, style.value];
                    update("dance_styles", updated);
                  }}
                />
                {style.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          placeholder="Tell people what to expect..."
          rows={4}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>
    </fieldset>
  );
}
