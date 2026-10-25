import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { METRO_ACTIVITY, METRO_HEALTH, OPERATIONAL_ISSUES, ORGANIZER_ACTIVITY, operationalDate, type Operations, type OperationOffsets, type Page, type Severity } from "../../model/operationalAnalytics";
import "./OperationalInsights.css";

interface Props { data: Operations | null; loading: boolean; error: string | null; offsets: OperationOffsets; onOffsetsChange: (value: OperationOffsets) => void; retry: () => void }
const SEVERITY_LABELS = { critical: "Critical", attention: "Attention", informational: "Informational" };
function Priority({ value }: { value: Severity }) { return <span className={`operational-insights__priority operational-insights__priority--${value}`}>{SEVERITY_LABELS[value]}</span>; }
function Hours({ value }: { value: number | null }) { return <>{value === null ? "Not applicable" : value >= 48 ? `${(value / 24).toFixed(1)} days` : `${value.toFixed(1)} hours`}</>; }
function State({ loading, available, retry, children, tracking = false }: { loading: boolean; available: boolean; retry: () => void; children: ReactNode; tracking?: boolean }) {
  if (loading) return <div role="status" className="operational-insights__loading">Loading operational insights…<div className="admin-skeleton" aria-hidden="true" /></div>;
  if (!available) return <div className="operational-insights__state"><p>{tracking ? "Engagement insights unavailable. Tracking data is not yet available for this period." : "This operational data source is unavailable. Please try again."}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry section</button></div>;
  return children;
}
function Detail({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  const id = `operations-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <section id={id} aria-labelledby={`${id}-title`} className="operational-insights__detail"><details open={open || undefined}><summary><h3 id={`${id}-title`}>{title}</h3></summary><div className="operational-insights__detail-body">{children}</div></details></section>;
}
function Table({ title, columns, rows }: { title: string; columns: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return <table className="operational-insights__table"><caption className="admin-visually-hidden">{title}</caption><thead><tr>{columns.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.key}>{r.cells.map((cell, i) => i === 0 ? <th scope="row" key={columns[i]}>{cell}</th> : <td key={columns[i]}><span className="operational-insights__mobile-label" aria-hidden="true">{columns[i]}</span><span>{cell}</span></td>)}</tr>)}</tbody></table>;
}
function Pager({ source, loading, offset, label, set }: { source: Page<unknown> | null; loading: boolean; offset: number; label: string; set: (offset: number) => void }) {
  const previousDisabled = loading || !source || offset === 0;
  const nextDisabled = loading || !source || offset + source.rows.length >= source.total;
  // Keep controls mounted and focusable during loading; aria-disabled actions are guarded.
  return <nav className="operational-insights__pagination" aria-label={`${label} pagination`}><span>{loading ? "Loading records…" : !source ? "Records unavailable" : source.total === 0 ? "0 records" : `${offset + 1}–${offset + source.rows.length} of ${source.total}`}</span><div><button className="admin-btn admin-btn--secondary" type="button" aria-disabled={previousDisabled} onClick={() => { if (!previousDisabled) set(Math.max(0, offset - 25)); }}>Previous {label}</button><button className="admin-btn admin-btn--secondary" type="button" aria-disabled={nextDisabled} onClick={() => { if (!nextDisabled) set(offset + 25); }}>Next {label}</button></div></nav>;
}
export default function OperationalInsights({ data, loading, error, offsets, onOffsetsChange, retry }: Props) {
  const s = data?.submissions, m = data?.metros, o = data?.organizers, q = data?.quality, e = data?.opportunities;
  const actions: { key: string; title: string; count: number; explanation: string; priority: Severity; to: string; label: string }[] = [];
  if (s && s.pending > 0) actions.push({ key: "submissions", title: "Submissions awaiting review", count: s.pending, explanation: `${s.over_48} older than 48 hours; ${s.over_7d} older than seven days.`, priority: s.over_7d > 0 ? "critical" : s.over_48 > 0 ? "attention" : "informational", to: "/admin/submissions", label: "Review Submissions" });
  if (q) for (const [key, title] of [["missing_venue", "Upcoming events missing venues"], ["missing_organizer", "Upcoming events missing organizers"]] as const) {
    if (q.counts[key] > 0) actions.push({ key, title, count: q.counts[key], explanation: "Optional canonical association worth reviewing; event approval is unchanged.", priority: "informational", to: "/admin/events", label: "Review Events" });
  }
  if (q && q.affected_events > 0) actions.push({ key: "quality", title: "Upcoming events with data-quality issues", count: q.affected_events, explanation: `${q.critical_events} have blank required titles. Recommended and optional information is flagged separately.`, priority: q.critical_events > 0 ? "critical" : q.counts.missing_flyer + q.counts.missing_location + q.counts.missing_metro + q.counts.missing_taxonomy > 0 ? "attention" : "informational", to: "#operations-event-data-quality-action-queue", label: "Explore data quality" });
  if (m && m.low_inventory > 0) actions.push({ key: "metros", title: "Metropolitan areas with low inventory", count: m.low_inventory, explanation: `Recorded approved history, fewer than ${data?.thresholds?.healthy_inventory ?? 5} upcoming approved events. Never-active metros excluded.`, priority: m.critical > 0 || m.previously_active > 0 ? "attention" : "informational", to: "#operations-metropolitan-inventory-health", label: "Explore Metro Coverage" });
  if (o && o.no_upcoming > o.no_history) actions.push({ key: "organizers", title: "Associated organizers without upcoming events", count: o.no_upcoming - o.no_history, explanation: "Review canonical associations; no stopped-publication claim or automatic outreach.", priority: "informational", to: "/admin/organizers", label: "Review Organizers" });
  const priorityOrder = { critical: 0, attention: 1, informational: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const allAvailable = Boolean(s && m && o && q);
  const setOffset = (key: keyof OperationOffsets, value: number) => onOffsetsChange({ ...offsets, [key]: value });
  // In-page actions expand their existing disclosure, rather than adding a new workflow.
  const reveal = (id: string) => document.querySelector<HTMLDetailsElement>(`${id} details`)?.setAttribute("open", "");
  return <div className="operational-insights">
    <section className="admin-card" aria-labelledby="platform-action-center-title" aria-busy={loading}>
      <h2 id="platform-action-center-title">Platform Action Center</h2>
      <p className="operational-insights__note">Current platform issues. Review and decide in existing management pages; no records are changed here.</p>
      {error && <div role="alert" className="admin-banner admin-banner--error"><p>{error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry operational insights</button></div>}
      {loading ? <State loading available={false} retry={retry}>{null}</State> : <>
        {actions.length === 0 && allAvailable && <p>No urgent platform issues found.</p>}
        {!allAvailable && <p role="status" className="operational-insights__note">Some operational sources are unavailable. Available issues remain visible; missing sources are not counted as zero.</p>}
        <ul className="operational-insights__actions">{actions.map((a) => <li key={a.key}><div><h3>{a.count.toLocaleString()} {a.title.toLowerCase()}</h3><p>{a.explanation}</p></div><Priority value={a.priority} />{a.to.startsWith("#") ? <a className="admin-btn admin-btn--secondary" href={a.to} onClick={() => reveal(a.to)}>{a.label}</a> : <Link className="admin-btn admin-btn--secondary" to={a.to}>{a.label}</Link>}</li>)}</ul>
      </>}
    </section>
    <section className="admin-card" aria-labelledby="operational-insights-title">
      <h2 id="operational-insights-title">Operational insights</h2>
      <p className="operational-insights__note">Expand a queue for record-level review. Inventory, organizer activity, quality and pending review are current state, independent of the reporting period.</p>
      <Detail title="Submission review health" open>
        <State loading={loading} available={Boolean(s)} retry={retry}>{s && <>
          {s.pending === 0 ? <p>No submissions are currently awaiting review.</p> : <>
            <dl className="operational-insights__stats"><div><dt>Pending submissions</dt><dd>{s.pending}</dd></div><div><dt>Average waiting time</dt><dd><Hours value={s.average_hours} /></dd></div><div><dt>Oldest pending submission</dt><dd><Hours value={s.oldest_hours} /></dd></div></dl>
            <Table title="Submission age distribution" columns={["Waiting time", "Pending submissions"]} rows={[["Under or equal to 24 hours", s.under_24], ["Over 24–48 hours", s.hours_24_48], ["Over 2–7 days", s.days_2_7], ["Over 7 days", s.over_7d]].map(([label, value]) => ({ key: String(label), cells: [label, value] }))} />
            <p className="operational-insights__note">Cumulative backlog: over 24 hours {s.over_24}; over 48 hours {s.over_48}; over 7 days {s.over_7d}.</p>
          </>}
          <p className="operational-insights__note">Pending and in_review only. Waiting age uses submitted_at and the database snapshot instant. Needs-information submissions await the submitter, not moderation.</p>
          <Link className="admin-btn admin-btn--secondary" to="/admin/submissions">Open Moderation Queue</Link>
        </>}</State>
      </Detail>
      <Detail title="Metropolitan inventory health">
        <State loading={loading} available={Boolean(m)} retry={retry}>{m && <>
          <p>{m.active} active metros · {m.limited} limited · {m.critical} critical · {m.previously_active} previously active without upcoming events</p>
          <p className="operational-insights__note">Healthy: {data?.thresholds?.healthy_inventory ?? 5}+; limited: {data?.thresholds?.limited_inventory ?? 2}–{(data?.thresholds?.healthy_inventory ?? 5) - 1}; critical: 1; none: 0. Product defaults, not statistical benchmarks. Upcoming includes today in Eastern time; 7/30-day windows use Eastern midnights. Newly emerging means no currently recorded approved past event, not a proven launch date.</p>
          {m.total === 0 ? <p>No metropolitan areas have recorded approved event history.</p> : <Table title="Canonical metro inventory" columns={["Metro", "Inventory", "Within 7 / 30 days", "Organizers / venues", "Last known event date", "History"]} rows={m.rows.map((r) => ({ key: r.id, cells: [<>{r.name}<small>{r.slug}</small></>, <>{r.upcoming_events} upcoming<small>{METRO_HEALTH[r.health]}</small></>, `${r.events_7d} / ${r.events_30d}`, `${r.active_organizers} / ${r.active_venues}`, operationalDate(r.last_event_at), METRO_ACTIVITY[r.activity]] }))} />}
          <p className="operational-insights__note">No metro-management route exists. Review canonical event inventory in Events; no invented management link.</p><Link className="admin-btn admin-btn--secondary" to="/admin/events">Review metro event inventory</Link>
        </>}</State>
        <Pager source={m ?? null} loading={loading} offset={offsets.metro} label="metros" set={(v) => setOffset("metro", v)} />
      </Detail>
      <Detail title="Organizer activity monitoring">
        <State loading={loading} available={Boolean(o)} retry={retry}>{o && <>
          <p>{o.total} canonical organizers · {o.active} active · {o.no_upcoming} without upcoming events · {o.past_only} past events only · {o.no_history} without associated events · {o.previously_frequent} previously frequent contributors</p>
          <p className="operational-insights__note">Canonical organizer_id only. Past-only means all associated events are approved past events. Previously frequent means at least five recorded approved past occurrences, not publication frequency. Associated unapproved records are distinguished from no history. No outreach or activity-decline prediction.</p>
          {o.total === 0 ? <p>No canonical organizers are stored.</p> : <Table title="Canonical organizer activity" columns={["Organizer", "Activity", "Upcoming events", "Last occurred event", "Previous contribution"]} rows={o.rows.map((r) => ({ key: r.id, cells: [<Link className="operational-insights__link" to={`/admin/organizers/${r.id}`}>{r.name}</Link>, ORGANIZER_ACTIVITY[r.activity], r.upcoming_events, operationalDate(r.last_event_at), r.previously_frequent ? "At least 5 approved past events" : "Below screening threshold"] }))} />}
        </>}</State>
        <Pager source={o ?? null} loading={loading} offset={offsets.organizer} label="organizers" set={(v) => setOffset("organizer", v)} />
      </Detail>
      <Detail title="Event data quality action queue">
        <State loading={loading} available={Boolean(q)} retry={retry}>{q && <>
          <p className="operational-insights__note">Approved upcoming events only. Canonical venue/organizer associations are optional (Informational); flyer, location/address, metro and dance styles are recommended (Attention); blank required title is Critical. HTTP(S) or same-origin flyer references are accepted; image reachability is not tested. Venue name/address fallback and canonical taxonomy with legacy fallback are respected.</p>
          <dl className="operational-insights__stats">{Object.entries(q.counts).map(([key, count]) => <div key={key}><dt>{OPERATIONAL_ISSUES[key as keyof typeof OPERATIONAL_ISSUES]}</dt><dd>{count}</dd></div>)}</dl>
          {q.total === 0 ? <p>No upcoming event issues found by these checks.</p> : <Table title="Upcoming event quality issues" columns={["Event", "Issue", "Priority", "Scheduled date"]} rows={q.rows.map((r) => ({ key: `${r.id}-${r.key}`, cells: [<Link className="operational-insights__link" to={`/admin/events?edit=${r.id}`}>{r.title.trim() || "Untitled event"}</Link>, OPERATIONAL_ISSUES[r.key], <Priority value={r.severity} />, operationalDate(r.event_date)] }))} />}
        </>}</State>
        <Pager source={q ?? null} loading={loading} offset={offsets.quality} label="quality issues" set={(v) => setOffset("quality", v)} />
      </Detail>
      <Detail title="Event engagement opportunities">
        <State loading={loading} available={Boolean(e)} tracking retry={retry}>{e && <>
          <p className="operational-insights__note">Approved events with at least {data?.thresholds?.minimum_views ?? 25} detail views and outbound click-to-view ratio below {data?.thresholds?.maximum_ratio ?? 5}%, within the selected reporting period. Configurable screening defaults, not statistical findings. Ratio = (RSVP clicks + ticket clicks) ÷ detail views × 100; not completed registrations or purchases. Saves unsupported. Earliest retained interaction: {operationalDate(data?.firstRecordedAt ?? null)}.</p>
          {e.total === 0 ? <p>No events meet the engagement screening thresholds in this period.</p> : <Table title="Engagement opportunities" columns={["Event", "Detail views", "RSVP clicks", "Ticket clicks", "Shares", "Click-to-view ratio"]} rows={e.rows.map((r) => ({ key: r.id, cells: [<Link className="operational-insights__link" to={`/admin/events?edit=${r.id}`}>{r.title}</Link>, r.detail_views, r.rsvp_clicks, r.ticket_clicks, r.shares, `${r.ratio.toFixed(1)}%`] }))} />}
        </>}</State>
        <Pager source={e ?? null} loading={loading} offset={offsets.engagement} label="engagement opportunities" set={(v) => setOffset("engagement", v)} />
      </Detail>
      <Detail title="Platform activity summary">
        <State loading={loading} available={Boolean(data?.activity)} retry={retry}>{data?.activity && <>
          <dl className="operational-insights__stats">{Object.entries(data.activity).map(([key, value]) => <div key={key}><dt>{({ events: "New events", accounts: "New accounts", submissions: "New submissions", organizers: "New organizers", venues: "New venues", new_metros: "First recorded metro event creation" } as Record<string, string>)[key]}</dt><dd>{value === null ? "Unavailable" : value}</dd></div>)}</dl>
          <p className="operational-insights__note">Selected period, authoritative created_at timestamps; submissions use submitted_at. Undated rows excluded even for All time (unlike Phase 1 stored totals). Metro first activity is the earliest stored event creation timestamp, not historical approval. Approval activity unavailable: no immutable approval timestamp exists.</p>
        </>}</State>
      </Detail>
      <p className="operational-insights__note">Snapshot: {operationalDate(data?.asOf ?? null)}. No inventory-loss trend inferred without historical snapshots.</p>
    </section>
  </div>;
}
