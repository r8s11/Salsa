import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardShell from "../components/Dashboard/DashboardShell";
import { HOST_RAIL } from "./HostDashboardPage-v2";
import "./HostEventDashboardPage-v2.css";

type Attendee = {
  id: string;
  name: string;
  initials: string;
  tag: string;
  tone: "plain" | "good" | "gold";
  meta: string;
  /** Already through the door when the page loads. */
  pre: boolean;
  list: "registered" | "guests";
};

const ROSTER: Attendee[] = [
  { id: "g2", name: "Julia Santos", initials: "JS", tag: "Self checked-in", tone: "good", meta: "Scanned her own QR at 9:14 PM", pre: true, list: "registered" },
  { id: "g5", name: "Priya Raman", initials: "PR", tag: "Registered", tone: "plain", meta: "RSVP Oct 09 · paid online", pre: false, list: "registered" },
  { id: "g7", name: "Andre Lima", initials: "AL", tag: "Registered", tone: "plain", meta: "RSVP Oct 14 · +1", pre: false, list: "registered" },
  { id: "g8", name: "Nadia Haddad", initials: "NH", tag: "Registered", tone: "plain", meta: "RSVP Oct 18", pre: true, list: "registered" },
  { id: "g1", name: "Elena Rodriguez", initials: "ER", tag: "Comp", tone: "gold", meta: "+1 guest · added by Carlos", pre: false, list: "guests" },
  { id: "g3", name: "Marcus Rivera", initials: "MR", tag: "Performer", tone: "gold", meta: "Bachata room · 11:30 PM set", pre: false, list: "guests" },
  { id: "g4", name: "Dani Ortiz", initials: "DO", tag: "Comp", tone: "gold", meta: "Added by Carlos", pre: true, list: "guests" },
  { id: "g6", name: "Tomás Beltré", initials: "TB", tag: "Instructor", tone: "gold", meta: "Runs the 9:30 lesson", pre: true, list: "guests" },
];

const SEED_TASKS = [
  { id: "t1", label: "Confirm DJ Suave for the bachata room", meta: "Set is at 11:30" },
  { id: "t2", label: "Print the door list and comp sheet", meta: "Before 8:30 PM" },
  { id: "t3", label: "Post the lineup to stories", meta: "Today" },
  { id: "t4", label: "Brief the door team on the guest list", meta: "At 8:45 PM" },
];

const TIMELINE = [
  { title: "Doors open", meta: "9:00 PM · door team of 3", dot: "var(--ss-red)" },
  { title: "Beginner lesson", meta: "9:30 PM · Tomás Beltré", dot: "var(--ss-gold)" },
  { title: "Open dancing", meta: "10:00 PM · DJ Ritmo", dot: "var(--ss-tertiary)" },
  { title: "Performance", meta: "11:30 PM · Marcus Rivera", dot: "var(--ss-text-dim)" },
];

const CHECK_TABS = ["Everyone", "Checked in", "Not yet"] as const;
const LISTS = [
  { id: "registered" as const, label: "Registered" },
  { id: "guests" as const, label: "Guest list" },
];

export default function HostEventDashboardPageV2() {
  const { eventId = "ev-havana" } = useParams();

  const [checkins, setCheckins] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Attendee[]>([]);
  const [list, setList] = useState<"registered" | "guests">("registered");
  const [checkTab, setCheckTab] = useState<(typeof CHECK_TABS)[number]>("Everyone");
  const [newName, setNewName] = useState("");
  const [doorMode, setDoorMode] = useState(false);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
  const [extraTasks, setExtraTasks] = useState<typeof SEED_TASKS>([]);
  const [newTask, setNewTask] = useState("");

  const roster = useMemo(
    () =>
      [...ROSTER, ...added]
        .filter((a) => !removed[a.id])
        .map((a) => ({ ...a, checkedIn: a.pre || !!checkins[a.id] })),
    [added, checkins, removed]
  );

  const checkedCount = roster.filter((a) => a.checkedIn).length;
  const guestCount = roster.filter((a) => a.list === "guests").length;
  const registeredCount = roster.filter((a) => a.list === "registered").length;

  const visible = useMemo(() => {
    const inList = roster.filter((a) => a.list === list);
    if (checkTab === "Checked in") return inList.filter((a) => a.checkedIn);
    if (checkTab === "Not yet") return inList.filter((a) => !a.checkedIn);
    return inList;
  }, [checkTab, list, roster]);

  const doorQueue = roster.filter((a) => !a.checkedIn);

  const tasks = [...SEED_TASKS, ...extraTasks];
  const openTasks = tasks.filter((t) => !taskDone[t.id]).length;

  const addPerson = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const parts = name.split(/\s+/);
    const initials = (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    setAdded((prev) => [
      ...prev,
      {
        id: `w${Date.now()}`,
        name,
        initials,
        tag: list === "guests" ? "Guest list" : "Added at door",
        tone: list === "guests" ? "gold" : "good",
        meta: list === "guests" ? "Added by you just now" : "Registered at the door just now",
        pre: true,
        list,
      },
    ]);
    setNewName("");
  };

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const label = newTask.trim();
    if (!label) return;
    setExtraTasks((prev) => [...prev, { id: `t${Date.now()}`, label, meta: "Added by you" }]);
    setNewTask("");
  };

  const kpis = [
    { label: "RSVPs", value: "340", sub: "of 400 capacity", pct: 85, bar: "var(--ss-red)", note: "85% of the room booked" },
    { label: "Checked in", value: String(checkedCount), sub: "at the door", pct: Math.round((checkedCount / 340) * 100), bar: "var(--ss-tertiary)", note: "Live count from the door team" },
    { label: "Guest list", value: String(guestCount), sub: "added by you", pct: 40, bar: "var(--ss-gold)", note: "Comps, staff, performers and walk-ins" },
  ];

  return (
    <DashboardShell breadcrumb="Host · Event Dashboard" sections={HOST_RAIL}>
      <div className="ss-page">
        <div className="ss-row ss-row--between">
          <div>
            <Link to="/host/events" className="ss-linkbtn">
              ← All my events
            </Link>
            <div className="event-dash__heading">
              <h1 className="ss-h1">Havana Nights Social</h1>
              <span className="ss-badge ss-badge--live">Live</span>
            </div>
            <p className="ss-lede">Fri, Oct 24 · 9:00 PM · The Grand Ballroom, Downtown</p>
          </div>

          <div className="ss-row">
            <Link to={`/events/${eventId}`} className="ss-btn ss-btn--ghost">
              View event page
            </Link>
            <button type="button" className="ss-btn ss-btn--ghost">
              Export guest list
            </button>
            <Link to={`/host/events/${eventId}/edit`} className="ss-btn ss-btn--ghost">
              Edit event
            </Link>
            <button type="button" className="ss-btn ss-btn--primary" onClick={() => setDoorMode(true)}>
              Open door mode
            </button>
          </div>
        </div>

        <div className="ss-grid">
          {kpis.map((k) => (
            <div className="ss-kpi" key={k.label}>
              <div className="ss-kpi__top">
                <span className="ss-kpi__label">{k.label}</span>
              </div>
              <div className="event-dash__kpi-value">
                <span className="ss-kpi__value">{k.value}</span>
                <span className="ss-kpi__sub">{k.sub}</span>
              </div>
              <div className="ss-bar">
                <div className="ss-bar__fill" style={{ width: `${k.pct}%`, background: k.bar }} />
              </div>
              <div className="ss-kpi__note">{k.note}</div>
            </div>
          ))}
        </div>

        <div className="ss-split">
          {/* ---------- door & check-in ---------- */}
          <div className="ss-card ss-card--flush">
            <div className="ss-card__head">
              <h2 className="ss-h2">Door &amp; check-in</h2>
              <div className="ss-chips">
                {CHECK_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="ss-chip"
                    aria-pressed={checkTab === t}
                    onClick={() => setCheckTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="event-dash__controls">
              <div className="ss-segmented">
                {LISTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="ss-segmented__opt"
                    aria-pressed={list === l.id}
                    onClick={() => setList(l.id)}
                  >
                    {l.label}{" "}
                    <span className="event-dash__count">
                      {l.id === "guests" ? guestCount : registeredCount}
                    </span>
                  </button>
                ))}
              </div>

              <input className="ss-input" type="text" placeholder="Search this list…" />

              <form className="event-dash__add" onSubmit={addPerson}>
                <input
                  className="ss-input"
                  type="text"
                  placeholder="Full name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <button type="submit" className="ss-btn ss-btn--danger ss-btn--sm">
                  + {list === "guests" ? "Add to guest list" : "Register at the door"}
                </button>
              </form>

              <span className="ss-hint">
                {list === "guests"
                  ? "Comps, staff and performers — people who never booked online."
                  : "Someone who turned up without booking. Creates a real registration."}
              </span>
            </div>

            <div>
              {visible.map((a) => (
                <div className="event-dash__row" key={a.id}>
                  <span className="ss-avatar event-dash__avatar">{a.initials}</span>
                  <div className="event-dash__row-body">
                    <div className="event-dash__row-name">{a.name}</div>
                    <div className="event-dash__row-meta">
                      <span
                        className={
                          a.tone === "good"
                            ? "event-dash__tag event-dash__tag--good"
                            : a.tone === "gold"
                            ? "event-dash__tag event-dash__tag--gold"
                            : "event-dash__tag"
                        }
                      >
                        {a.tag}
                      </span>
                      <span className="ss-muted">{a.meta}</span>
                    </div>
                  </div>

                  {a.checkedIn ? (
                    <span className="event-dash__in">✓ Checked in</span>
                  ) : (
                    <button
                      type="button"
                      className="ss-btn ss-btn--primary ss-btn--sm"
                      onClick={() => setCheckins((p) => ({ ...p, [a.id]: true }))}
                    >
                      Check in
                    </button>
                  )}

                  <button
                    type="button"
                    className="event-dash__remove"
                    aria-label={`Remove ${a.name} from list`}
                    title="Remove from list"
                    onClick={() => setRemoved((p) => ({ ...p, [a.id]: true }))}
                  >
                    ×
                  </button>
                </div>
              ))}

              {visible.length === 0 && <div className="ss-empty event-dash__empty">Nobody in this list yet.</div>}
            </div>

            <div className="event-dash__foot">
              {checkedCount} of 340 registered dancers checked in
            </div>
          </div>

          {/* ---------- side column ---------- */}
          <div className="ss-stack">
            <div className="ss-card">
              <div className="ss-row ss-row--between event-dash__card-head">
                <h2 className="ss-h2">Tasks for this night</h2>
                <span className="ss-muted">
                  {openTasks === 0 ? "All clear" : `${openTasks} open of ${tasks.length}`}
                </span>
              </div>

              <div>
                {tasks.map((t) => {
                  const done = !!taskDone[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="event-dash__task"
                      aria-pressed={done}
                      onClick={() => setTaskDone((p) => ({ ...p, [t.id]: !p[t.id] }))}
                    >
                      <span className="event-dash__checkbox">{done ? "✓" : ""}</span>
                      <span>
                        <span className="event-dash__task-label">{t.label}</span>
                        <span className="event-dash__task-meta">{done ? "Done" : t.meta}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <form className="event-dash__add event-dash__add--task" onSubmit={addTask}>
                <input
                  className="ss-input"
                  type="text"
                  placeholder="Add a task for this night…"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
                <button type="submit" className="ss-btn ss-btn--danger ss-btn--sm">
                  Add
                </button>
              </form>
            </div>

            <div className="ss-card">
              <h2 className="ss-h2 event-dash__card-head">Tonight&apos;s timeline</h2>
              {TIMELINE.map((t) => (
                <div className="event-dash__tl" key={t.title}>
                  <span className="event-dash__tl-dot" style={{ background: t.dot }} />
                  <div>
                    <div className="event-dash__tl-title">{t.title}</div>
                    <div className="ss-muted">{t.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- door mode ---------- */}
      {doorMode && (
        <div className="door-mode" role="dialog" aria-modal="true" aria-label="Door mode">
          <div className="door-mode__top">
            <div>
              <div className="door-mode__kicker">Door mode</div>
              <div className="door-mode__count">
                {checkedCount} <span>/ 340 in</span>
              </div>
            </div>
            <button type="button" className="ss-btn ss-btn--ghost" onClick={() => setDoorMode(false)}>
              Exit door mode
            </button>
          </div>

          <input className="door-mode__search" type="text" placeholder="Scan a QR or type a name…" />
          <div className="door-mode__hint">
            {doorQueue.length === 1 ? "1 still to arrive" : `${doorQueue.length} still to arrive`} ·
            tap a name to check them in
          </div>

          <div className="door-mode__list">
            {doorQueue.map((a) => (
              <button
                key={a.id}
                type="button"
                className="door-mode__row"
                onClick={() => setCheckins((p) => ({ ...p, [a.id]: true }))}
              >
                <span className="ss-avatar door-mode__avatar">{a.initials}</span>
                <span className="door-mode__row-body">
                  <span className="door-mode__row-name">{a.name}</span>
                  <span className="ss-muted">
                    {a.tag} · {a.meta}
                  </span>
                </span>
                <span className="door-mode__cta">Check in</span>
              </button>
            ))}
            {doorQueue.length === 0 && (
              <div className="door-mode__done">Everyone on the list is in.</div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
