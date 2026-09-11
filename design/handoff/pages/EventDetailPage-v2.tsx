import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./EventDetailPage-v2.css";

type LineupMember = {
  name: string;
  role: string;
  /** Which profile type this person links to. */
  target: "instructor" | "performer" | "dj" | "host";
};

type EventRecord = {
  id: string;
  kind: "social" | "class" | "workshop";
  typeLabel: string;
  title: string;
  weekday: string;
  day: string;
  month: string;
  dateLine: string;
  time: string;
  venue: string;
  address: string;
  price: string;
  description: string;
  styles: string[];
  tags: string[];
  lineup: LineupMember[];
  host: { name: string; initials: string; meta: string };
  classFacts?: { label: string; value: string }[];
};

const EVENT: EventRecord = {
  id: "ev-havana",
  kind: "social",
  typeLabel: "Social",
  title: "Havana Nights Social",
  weekday: "Fri",
  day: "24",
  month: "OCT",
  dateLine: "Friday, October 24",
  time: "9:00 PM – 1:00 AM",
  venue: "The Grand Ballroom",
  address: "288 Green St, Cambridge, MA",
  price: "$15 at the door",
  description:
    "The classic Cambridge Latin night: salsa, bachata, merengue and cha-cha until 1 AM. Beginner lesson at 9:30, then the floor is yours. Live percussion sits in with the DJ for the midnight set.",
  styles: ["Salsa On1", "Bachata", "Cha-cha", "Merengue"],
  tags: ["Beginner friendly", "Live music", "No partner needed"],
  lineup: [
    { name: "Tomás Beltré", role: "Beginner lesson · 9:30 PM", target: "instructor" },
    { name: "Marcus Rivera", role: "Bachata showcase · 11:30 PM", target: "performer" },
    { name: "Los Timbaleros", role: "Live percussion · midnight set", target: "performer" },
    { name: "DJ Nolo Rivas", role: "Main room · 10 PM – 1 AM", target: "dj" },
  ],
  host: { name: "Carlos Mendez", initials: "CM", meta: "Host · 6 events this year" },
};

const GROUP_TITLES: Record<LineupMember["target"], string> = {
  instructor: "Class instructor",
  performer: "Performances",
  dj: "DJ",
  host: "Also on the night",
};

const GROUP_ORDER: LineupMember["target"][] = ["instructor", "performer", "dj", "host"];

const ALBUM = {
  public: [
    { id: 1, wide: true, by: "Lupe Ortega" },
    { id: 2, wide: false, by: "Lupe Ortega" },
  ],
  attendees: [
    { id: 3, wide: true, by: "Julia S." },
    { id: 4, wide: false, by: "Andre L." },
    { id: 5, wide: false, by: "Priya R." },
  ],
};

export default function EventDetailPageV2() {
  const { eventId } = useParams();
  const event = EVENT; // swap for your fetch — eventId is here for wiring
  void eventId;

  const [tab, setTab] = useState<"about" | "album">("about");
  const [albumFilter, setAlbumFilter] = useState<"public" | "attendees">("public");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [going, setGoing] = useState(false);

  const groups = useMemo(() => {
    const isSocial = event.kind === "social";
    return GROUP_ORDER.map((target) => ({
      target,
      title: target === "instructor" && isSocial ? "Lesson instructor" : GROUP_TITLES[target],
      items: event.lineup.filter((l) => l.target === target),
    })).filter((g) => g.items.length > 0);
  }, [event]);

  const photos = ALBUM[albumFilter];
  const isClass = event.kind === "class" || event.kind === "workshop";

  return (
    <div className="event-page">
      {/* ---------- cover ---------- */}
      <div className="event-page__cover">
        <div className="event-page__cover-art" />
        <div className="event-page__cover-bar">
          <Link to="/calendar" className="event-page__back">
            ← The calendar
          </Link>
        </div>
        <div className="event-page__cover-body">
          <span className="ss-badge ss-badge--live">{event.typeLabel}</span>
          <h1 className="event-page__title">{event.title}</h1>
          <div className="event-page__facts">
            <span>🗓 {event.dateLine}</span>
            <span>🕐 {event.time}</span>
            <span>📍 {event.venue}</span>
          </div>
        </div>
      </div>

      <div className="event-page__body">
        {/* ---------- action strip ---------- */}
        <div className="event-page__strip">
          <div className="event-page__datechip">
            <span className="event-page__datechip-weekday">{event.weekday}</span>
            <span className="event-page__datechip-day">{event.day}</span>
            <span className="event-page__datechip-month">{event.month}</span>
          </div>
          <div className="event-page__strip-body">
            <div className="event-page__strip-price">{event.price}</div>
            <div className="ss-muted">{event.address}</div>
          </div>
          <div className="event-page__strip-actions">
            <button
              type="button"
              className={going ? "ss-btn ss-btn--ghost" : "ss-btn ss-btn--primary"}
              aria-pressed={going}
              onClick={() => setGoing((v) => !v)}
            >
              {going ? "You're going" : "I'm going"}
            </button>
            <button type="button" className="ss-btn ss-btn--ghost">
              Save
            </button>
          </div>
        </div>

        {/* ---------- tabs ---------- */}
        <nav className="event-page__tabs" aria-label="Sections">
          <button
            type="button"
            className="event-page__tab"
            aria-pressed={tab === "about"}
            onClick={() => setTab("about")}
          >
            About the night
          </button>
          <button
            type="button"
            className="event-page__tab"
            aria-pressed={tab === "album"}
            onClick={() => setTab("album")}
          >
            Photo album <span className="event-page__tab-count">5</span>
          </button>
        </nav>

        {tab === "about" ? (
          <div className="event-page__columns">
            <div className="ss-stack event-page__main">
              {isClass && event.classFacts && (
                <section className="event-page__classcard">
                  <h2 className="ss-section-label event-page__h2">
                    {event.kind === "workshop" ? "About the workshop" : "About the class"}
                  </h2>
                  <div className="event-page__classgrid">
                    {event.classFacts.map((f) => (
                      <div className="event-page__classfact" key={f.label}>
                        <span className="event-page__classfact-label">{f.label}</span>
                        <span className="event-page__classfact-value">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="ss-section-label event-page__h2">About the night</h2>
                <p className="event-page__desc">{event.description}</p>
                <div className="ss-chips event-page__styles">
                  {event.styles.map((s) => (
                    <span className="ss-badge" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="ss-chips event-page__tags">
                  {event.tags.map((t) => (
                    <span className="ss-badge ss-badge--warn" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="ss-section-label event-page__h2">The lineup</h2>
                <div className="ss-stack event-page__groups">
                  {groups.map((g) => (
                    <div key={g.target}>
                      <div className="event-page__group-title">{g.title}</div>
                      <div className="ss-stack event-page__group-items">
                        {g.items.map((l) => (
                          <Link
                            to={`/directory/${g.target}s`}
                            className="event-page__member"
                            key={l.name}
                          >
                            <span className="ss-avatar event-page__member-avatar">
                              {l.name.charAt(0)}
                            </span>
                            <span className="event-page__member-body">
                              <span className="event-page__member-name">{l.name}</span>
                              <span className="ss-muted">{l.role}</span>
                            </span>
                            <span className="event-page__member-cta">Profile →</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ---------- sidebar ---------- */}
            <aside className="ss-stack event-page__aside">
              <div className="ss-card event-page__hostcard">
                <div className="event-page__aside-label">Hosted by</div>
                <Link to="/directory/hosts" className="event-page__host">
                  <span className="ss-avatar event-page__host-avatar">{event.host.initials}</span>
                  <span>
                    <span className="event-page__host-name">{event.host.name}</span>
                    <span className="ss-muted event-page__host-meta">{event.host.meta}</span>
                  </span>
                </Link>
                <Link to="/directory/hosts" className="ss-btn ss-btn--ghost event-page__hostbtn">
                  Host page →
                </Link>
              </div>

              <div className="ss-card">
                <div className="event-page__aside-label">Where</div>
                <div className="event-page__venue">{event.venue}</div>
                <div className="ss-muted">{event.address}</div>
                <div className="ss-dropzone event-page__map">Map</div>
              </div>

              <div className="ss-card">
                <div className="event-page__aside-label">Share this night</div>
                <div className="event-page__share">
                  <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm">
                    Copy link
                  </button>
                  <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm">
                    Instagram
                  </button>
                  <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm">
                    WhatsApp
                  </button>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* ---------- photo album ---------- */
          <section className="event-page__album">
            <div className="event-page__album-head">
              <div>
                <h2 className="event-page__album-title">Photo album</h2>
                <p className="event-page__album-lede">
                  Anyone who registered for this night can add photos. The host picks a few to show
                  publicly — the rest stay visible only to people who were there.
                </p>
              </div>
              <button
                type="button"
                className="ss-btn ss-btn--primary"
                onClick={() => setUploadOpen((v) => !v)}
              >
                + Add your photos
              </button>
            </div>

            <div className="ss-chips event-page__album-filters">
              {(
                [
                  { id: "public" as const, label: "Public", count: ALBUM.public.length },
                  { id: "attendees" as const, label: "Attendees only", count: ALBUM.attendees.length },
                ]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="ss-chip"
                  aria-pressed={albumFilter === f.id}
                  onClick={() => setAlbumFilter(f.id)}
                >
                  {f.label} <span className="event-page__album-count">{f.count}</span>
                </button>
              ))}
            </div>

            {uploadOpen && (
              <div className="event-page__upload">
                <div className="ss-dropzone event-page__upload-slot">Drop a photo</div>
                <div className="event-page__upload-body">
                  <div className="ss-h2">Add to this album</div>
                  <p className="ss-muted event-page__upload-note">
                    Your photos go in as attendee shots. The host reviews them before any become
                    public.
                  </p>
                </div>
                <button
                  type="button"
                  className="ss-btn ss-btn--ghost"
                  onClick={() => setUploadOpen(false)}
                >
                  Done
                </button>
              </div>
            )}

            <div className="event-page__gallery">
              {photos.map((p) => (
                <div
                  className={p.wide ? "event-page__shot event-page__shot--wide" : "event-page__shot"}
                  key={p.id}
                >
                  <div className="ss-dropzone event-page__shot-slot">Photo {p.id}</div>
                  <span
                    className={
                      albumFilter === "public"
                        ? "event-page__shot-tag event-page__shot-tag--public"
                        : "event-page__shot-tag"
                    }
                  >
                    {albumFilter === "public" ? "Public" : "Attendees only"}
                  </span>
                  <span className="event-page__shot-by">{p.by}</span>
                </div>
              ))}
            </div>

            <div className="ss-muted event-page__album-foot">
              {albumFilter === "public"
                ? "2 of 5 photos are public. The host chose these for the event page and the feed."
                : "3 photos shared by people who were there. Only visible to registered attendees until the host makes one public."}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
