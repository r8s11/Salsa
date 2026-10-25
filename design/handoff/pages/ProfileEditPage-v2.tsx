import { useState } from "react";
import { Link } from "react-router-dom";
import "./ProfileEditPage-v2.css";

const STYLE_OPTIONS = [
  "Salsa On1",
  "Salsa On2",
  "Bachata",
  "Bachata sensual",
  "Cha-cha",
  "Kizomba",
  "Merengue",
  "Timba",
];

const LEVELS = ["New to it", "Improver", "Intermediate", "Advanced"] as const;

export default function ProfileEditPageV2() {
  const [form, setForm] = useState({
    name: "Sofia Marín",
    handle: "sofiamarin",
    tagline: "Dancer & event host · Greater Boston",
    bio:
      "On the floor four nights a week, usually at Havana Nights or Sala Roja. I host the first-Friday social and teach the beginner lesson before it.",
    city: "boston" as "boston" | "new-york-city",
    level: "Intermediate" as (typeof LEVELS)[number],
    instagram: "@SalsaSegura",
    website: "salsasegura.example",
    email: "sofia@example.com",
  });

  const [styles, setStyles] = useState<Record<string, boolean>>({
    "Salsa On1": true,
    Bachata: true,
    "Cha-cha": true,
  });

  const [visibility, setVisibility] = useState({
    stats: true,
    attending: true,
    contactEmail: false,
  });

  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: v }));
    setSaved(false);
  };

  const toggleVis = (key: keyof typeof visibility) => {
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
    setSaved(false);
  };

  return (
    <div className="ss-page">
      <div>
        <Link to="/profile" className="ss-linkbtn">
          ← Back to my profile
        </Link>
        <h1 className="ss-h1 profile-edit__title">Profile settings</h1>
        <p className="ss-lede">
          This is what other dancers see when they open your profile or tap your name on an event.
        </p>
      </div>

      {saved && (
        <div className="ss-notice">
          <span aria-hidden="true">✓</span>
          <span>Saved. Your profile is up to date.</span>
        </div>
      )}

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Photo &amp; name</h2>

        <div className="profile-edit__identity">
          <div className="profile-edit__portrait">
            <div className="ss-dropzone profile-edit__portrait-slot">Drop a portrait</div>
            <span className="ss-hint">Square, at least 400×400.</span>
          </div>

          <div className="ss-stack profile-edit__identity-fields">
            <label className="ss-field">
              <span className="ss-label">Display name *</span>
              <input
                className="ss-input"
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>

            <label className="ss-field">
              <span className="ss-label">Handle</span>
              <input
                className="ss-input"
                type="text"
                value={form.handle}
                onChange={(e) => set("handle", e.target.value)}
              />
              <span className="ss-hint">salsasegura.com/u/{form.handle || "your-handle"}</span>
            </label>

            <label className="ss-field">
              <span className="ss-label">Tagline</span>
              <input
                className="ss-input"
                type="text"
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="ss-field">
          <span className="ss-label">Cover image</span>
          <div className="ss-dropzone profile-edit__cover">Wide cover for your profile page</div>
        </div>
      </section>

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">About you</h2>

        <label className="ss-field">
          <span className="ss-label">Bio</span>
          <textarea
            className="ss-textarea"
            rows={4}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </label>

        <div className="ss-formrow">
          <div className="ss-field">
            <span className="ss-label">Home city</span>
            <div className="profile-edit__segmented">
              {(
                [
                  { id: "boston", label: "Greater Boston" },
                  { id: "new-york-city", label: "New York City" },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="profile-edit__segmented-opt"
                  aria-pressed={form.city === c.id}
                  onClick={() => set("city", c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label className="ss-field">
            <span className="ss-label">Where you&apos;re at</span>
            <select
              className="ss-select"
              value={form.level}
              onChange={(e) => set("level", e.target.value as (typeof LEVELS)[number])}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ss-field">
          <span className="ss-label">Dances you do</span>
          <div className="ss-chips">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="ss-chip"
                aria-pressed={!!styles[s]}
                onClick={() => {
                  setStyles((prev) => ({ ...prev, [s]: !prev[s] }));
                  setSaved(false);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Links</h2>
        <div className="ss-formrow">
          <label className="ss-field">
            <span className="ss-label">Instagram</span>
            <input
              className="ss-input"
              type="text"
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span className="ss-label">Website</span>
            <input
              className="ss-input"
              type="text"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </label>
        </div>
        <label className="ss-field">
          <span className="ss-label">Contact email</span>
          <input
            className="ss-input"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </label>
      </section>

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">What&apos;s public</h2>

        {(
          [
            {
              key: "stats" as const,
              title: "My numbers",
              meta: "Nights danced, events hosted, followers",
            },
            {
              key: "attending" as const,
              title: "Events I'm going to",
              meta: "Shows on your profile and to people you follow",
            },
            {
              key: "contactEmail" as const,
              title: "Contact email",
              meta: "Hosts and organizers can reach you directly",
            },
          ]
        ).map((row) => (
          <button
            key={row.key}
            type="button"
            className="ss-toggle"
            aria-pressed={visibility[row.key]}
            onClick={() => toggleVis(row.key)}
          >
            <span className="ss-toggle__track">
              <span className="ss-toggle__knob" />
            </span>
            <span>
              <span className="ss-toggle__title">{row.title}</span>
              <span className="ss-toggle__meta">
                {visibility[row.key] ? "Public · " : "Private · "}
                {row.meta}
              </span>
            </span>
          </button>
        ))}
      </section>

      <div className="ss-card profile-edit__actions">
        <button type="button" className="ss-btn ss-btn--primary" onClick={() => setSaved(true)}>
          Save profile
        </button>
        <Link to="/profile" className="ss-btn ss-btn--ghost">
          Discard
        </Link>
      </div>
    </div>
  );
}
