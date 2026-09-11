import { useState } from "react";
import { Link } from "react-router-dom";
import "./DjPublicPage-v2.css";

const DJ = {
  name: "DJ Nolo Rivas",
  initials: "NR",
  tagline: "Timba, On2 and bachata sensual · resident at Havana Nights",
  verified: true,
  cities: ["Greater Boston", "New York City"],
  bio:
    "Fifteen years behind the decks, most of them in Cambridge. I read the floor before the playlist — if the room wants timba at 1 AM, the room gets timba. Resident for the first-Friday social, guest rooms everywhere else.",
  stats: [
    { value: "412", label: "Followers" },
    { value: "9", label: "Nights booked" },
    { value: "2", label: "Cities" },
  ],
  styles: ["Salsa On1", "Salsa On2", "Timba", "Bachata sensual", "Cha-cha"],
  dates: [
    { weekday: "Fri", day: "24", month: "Oct", title: "Havana Nights Social", venue: "The Grand Ballroom, Boston", set: "11 PM – 1 AM", room: "Main room" },
    { weekday: "Fri", day: "31", month: "Oct", title: "Bachata Night Halloween", venue: "Sala Roja, Somerville", set: "10:30 PM – 12:30 AM", room: "Bachata room" },
    { weekday: "Fri", day: "07", month: "Nov", title: "Mambo Masterclass Social", venue: "Studio 4B, Arts District", set: "9 PM – 11 PM", room: "Main room" },
    { weekday: "Sat", day: "15", month: "Nov", title: "On2 Night", venue: "Havana Club, Cambridge", set: "11 PM – 2 AM", room: "Main room" },
  ],
  residencies: [
    { title: "Havana Nights", meta: "First Friday · resident since 2021" },
    { title: "Sala Roja bachata room", meta: "Monthly guest" },
  ],
};

const TABS = [
  { id: "sound", label: "Sound" },
  { id: "dates", label: "Next dates" },
  { id: "photos", label: "Photos" },
] as const;

type Props = {
  /** Owner view swaps the follow button for edit affordances. */
  isOwner?: boolean;
};

export default function DjPublicPageV2({ isOwner = false }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sound");
  const [following, setFollowing] = useState(false);

  return (
    <div className="dj-page">
      {/* ---------- cover ---------- */}
      <div className="dj-page__cover">
        <div className="dj-page__cover-art" />
        <div className="dj-page__cover-bar">
          <Link to="/directory/djs" className="dj-page__back">
            ← All DJs
          </Link>
          {isOwner && (
            <div className="dj-page__owner-actions">
              <button type="button" className="dj-page__owner-btn">
                Change cover
              </button>
              <Link to="/dj/page" className="dj-page__owner-btn dj-page__owner-btn--primary">
                Edit page
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="dj-page__body">
        {/* ---------- identity ---------- */}
        <div className="dj-page__identity">
          <div className="dj-page__portrait">
            <span className="ss-avatar dj-page__avatar">{DJ.initials}</span>
            {isOwner && (
              <button type="button" className="dj-page__portrait-edit" aria-label="Change portrait">
                ✎
              </button>
            )}
          </div>

          <div className="dj-page__identity-body">
            <div className="dj-page__namerow">
              <h1 className="dj-page__name">{DJ.name}</h1>
              {DJ.verified && <span className="ss-badge ss-badge--good">✓ Verified</span>}
            </div>
            <p className="dj-page__tagline">{DJ.tagline}</p>
            <div className="ss-chips dj-page__cities">
              {DJ.cities.map((c) => (
                <span className="ss-badge" key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>

          {!isOwner && (
            <div className="dj-page__identity-actions">
              <button
                type="button"
                className={following ? "ss-btn ss-btn--ghost" : "ss-btn ss-btn--primary"}
                aria-pressed={following}
                onClick={() => setFollowing((v) => !v)}
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </div>

        <div className="dj-page__stats">
          {DJ.stats.map((s) => (
            <div className="dj-page__stat" key={s.label}>
              <span className="dj-page__stat-value">{s.value}</span>
              <span className="dj-page__stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ---------- tabs ---------- */}
        <nav className="dj-page__tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="dj-page__tab"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="dj-page__columns">
          <div className="ss-stack dj-page__main">
            {tab === "sound" && (
              <>
                <section>
                  <h2 className="ss-section-label dj-page__h2">What I play</h2>
                  <p className="dj-page__bio">{DJ.bio}</p>
                  <div className="ss-chips dj-page__styles">
                    {DJ.styles.map((s) => (
                      <span className="ss-badge" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="ss-section-label dj-page__h2">Residencies</h2>
                  <div className="ss-stack dj-page__residencies">
                    {DJ.residencies.map((r) => (
                      <div className="ss-card dj-page__residency" key={r.title}>
                        <span className="dj-page__residency-title">{r.title}</span>
                        <span className="ss-muted">{r.meta}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {tab === "dates" && (
              <section>
                <h2 className="ss-section-label dj-page__h2">Where to catch him next</h2>
                <div className="ss-stack dj-page__dates">
                  {DJ.dates.map((d) => (
                    <div className="ss-card dj-page__date" key={d.title}>
                      <div className="dj-page__date-chip">
                        <span className="dj-page__date-weekday">{d.weekday}</span>
                        <span className="dj-page__date-day">{d.day}</span>
                        <span className="dj-page__date-month">{d.month}</span>
                      </div>
                      <div className="dj-page__date-body">
                        <div className="dj-page__date-title">{d.title}</div>
                        <div className="ss-muted">{d.venue}</div>
                      </div>
                      <div className="dj-page__date-set">
                        <span className="dj-page__date-time">{d.set}</span>
                        <span className="ss-muted">{d.room}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tab === "photos" && (
              <section>
                <h2 className="ss-section-label dj-page__h2">From the booth</h2>
                <div className="dj-page__gallery">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div className={n === 1 ? "dj-page__shot dj-page__shot--wide" : "dj-page__shot"} key={n}>
                      <div className="ss-dropzone dj-page__shot-slot">Photo {n}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ---------- sidebar ---------- */}
          <aside className="ss-stack dj-page__aside">
            <div className="dj-page__links">
              <div className="dj-page__links-title">Find me online</div>
              <p className="dj-page__links-body">
                Dates, sets and everything else go up here first.
              </p>
              <a href="#" className="dj-page__links-primary">
                djnolorivas.com
              </a>
              <div className="dj-page__links-row">
                <a href="#" className="dj-page__links-secondary">
                  Instagram
                </a>
                <a href="#" className="dj-page__links-secondary">
                  SoundCloud
                </a>
              </div>
            </div>

            <div className="ss-card dj-page__facts">
              <div className="dj-page__fact">
                <span className="dj-page__fact-label">Based in</span>
                <span className="dj-page__fact-value">Cambridge, MA</span>
              </div>
              <div className="dj-page__fact">
                <span className="dj-page__fact-label">Travels to</span>
                <span className="dj-page__fact-value">New York City · Providence</span>
              </div>
              <div className="dj-page__fact">
                <span className="dj-page__fact-label">Brings</span>
                <span className="dj-page__fact-value">Own controller, needs 2 monitors</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
