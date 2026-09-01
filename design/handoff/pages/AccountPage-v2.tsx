import { useState } from "react";
import { Link } from "react-router-dom";
import "./AccountPage-v2.css";

type Role = {
  name: string;
  badge: string;
  tone: "live" | "good" | "plain";
  desc: string;
  action: string;
  to: string;
};

const SESSIONS = [
  { id: "s1", device: "iPhone 15 · Boston", meta: "This device · last active now", current: true },
  { id: "s2", device: "MacBook Pro · Boston", meta: "Last active 2 hours ago", current: false },
  { id: "s3", device: "Chrome · New York City", meta: "Last active Oct 12", current: false },
];

type Props = {
  /** Only moderators and above see the moderator role card. */
  isModerator?: boolean;
};

export default function AccountPageV2({ isModerator = false }: Props) {
  const [prefs, setPrefs] = useState({
    weeklyEmail: true,
    eventReminders: true,
    newFollowers: false,
    hostReplies: true,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const roles: Role[] = [
    {
      name: "Dancer",
      badge: "Active",
      tone: "good",
      desc: "RSVP to nights, save events, follow organizers and DJs.",
      action: "View my profile",
      to: "/profile",
    },
    {
      name: "Host",
      badge: "Active",
      tone: "live",
      desc: "Publish your own events, run the door, manage attendees and lineups.",
      action: "Open host dashboard",
      to: "/host",
    },
    {
      name: "DJ",
      badge: "Active",
      tone: "live",
      desc: "Take booking requests, keep your schedule, manage your public DJ page.",
      action: "Open DJ dashboard",
      to: "/dj",
    },
  ];

  if (isModerator) {
    roles.push({
      name: "Moderator",
      badge: "Active",
      tone: "live",
      desc: "Review reports and appeals for your region.",
      action: "Open moderator tools",
      to: "/moderator",
    });
  }

  const badgeClass = (tone: Role["tone"]) =>
    tone === "live" ? "ss-badge ss-badge--live" : tone === "good" ? "ss-badge ss-badge--good" : "ss-badge";

  return (
    <div className="ss-page">
      <div>
        <div className="ss-eyebrow">My account</div>
        <h1 className="ss-h1">Sofia Marín</h1>
        <p className="ss-lede">
          Your roles, how we contact you, and where you&apos;re signed in.
        </p>
      </div>

      {saved && (
        <div className="ss-notice">
          <span aria-hidden="true">✓</span>
          <span>Preferences saved.</span>
        </div>
      )}

      <section className="ss-card account-v2__identity">
        <span className="ss-avatar account-v2__avatar">SM</span>
        <div className="account-v2__identity-body">
          <div className="account-v2__name">Sofia Marín</div>
          <div className="ss-muted">sofia@example.com · Greater Boston</div>
          <div className="ss-muted">Member since March 2024</div>
        </div>
        <div className="account-v2__identity-actions">
          <Link to="/profile" className="ss-btn ss-btn--ghost ss-btn--sm">
            View public profile
          </Link>
          <Link to="/profile/edit" className="ss-btn ss-btn--primary ss-btn--sm">
            Edit profile
          </Link>
        </div>
      </section>

      <section>
        <h2 className="ss-h2 account-v2__section-title">What you can do</h2>
        <div className="ss-grid--cards ss-grid">
          {roles.map((r) => (
            <div className="ss-card account-v2__role" key={r.name}>
              <div className="ss-row ss-row--between">
                <span className="account-v2__role-name">{r.name}</span>
                <span className={badgeClass(r.tone)}>{r.badge}</span>
              </div>
              <p className="ss-muted account-v2__role-desc">{r.desc}</p>
              <Link to={r.to} className="ss-linkbtn">
                {r.action} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="ss-card ss-stack">
        <h2 className="ss-section-label">Email &amp; notifications</h2>

        {(
          [
            { key: "weeklyEmail" as const, title: "Weekly what's-on email", meta: "Every Wednesday, for your city" },
            { key: "eventReminders" as const, title: "Event reminders", meta: "The morning of a night you RSVP'd to" },
            { key: "newFollowers" as const, title: "New followers", meta: "When someone follows your profile" },
            { key: "hostReplies" as const, title: "Replies from hosts", meta: "When a host answers a question you asked" },
          ]
        ).map((row) => (
          <button
            key={row.key}
            type="button"
            className="ss-toggle"
            aria-pressed={prefs[row.key]}
            onClick={() => toggle(row.key)}
          >
            <span className="ss-toggle__track">
              <span className="ss-toggle__knob" />
            </span>
            <span>
              <span className="ss-toggle__title">{row.title}</span>
              <span className="ss-toggle__meta">
                {prefs[row.key] ? "On · " : "Off · "}
                {row.meta}
              </span>
            </span>
          </button>
        ))}

        <button type="button" className="ss-btn ss-btn--primary account-v2__save" onClick={() => setSaved(true)}>
          Save preferences
        </button>
      </section>

      <section className="ss-card ss-card--flush">
        <div className="ss-card__head">
          <h2 className="ss-h2">Where you&apos;re signed in</h2>
          <button type="button" className="ss-linkbtn">
            Sign out everywhere
          </button>
        </div>
        {SESSIONS.map((s) => (
          <div className="account-v2__session" key={s.id}>
            <div>
              <div className="account-v2__session-device">{s.device}</div>
              <div className="ss-muted">{s.meta}</div>
            </div>
            {s.current ? (
              <span className="ss-badge ss-badge--good">This device</span>
            ) : (
              <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm">
                Sign out
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="ss-card account-v2__danger">
        <div>
          <h2 className="ss-h2">Delete account</h2>
          <p className="ss-muted account-v2__danger-body">
            Removes your profile, RSVPs and follows. Events you hosted stay on the calendar with the
            host name removed.
          </p>
        </div>
        <button type="button" className="ss-btn ss-btn--danger ss-btn--sm">
          Delete my account
        </button>
      </section>
    </div>
  );
}
