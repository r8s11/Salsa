import { Link } from "react-router-dom";
import {
  QUALITY_LABELS, type EntityIntelligence, type EntityPerformance, type EntityPerformanceOptions,
  type EntityPerformanceRow, type OrganizerPerformanceSort, type VenuePerformanceSort,
} from "../../model/analyticsQuery";
import "./EntityIntelligenceSection.css";

type Props = {
  data: EntityIntelligence | null;
  loading: boolean;
  error: string | null;
  options: EntityPerformanceOptions;
  onOptionsChange: (options: EntityPerformanceOptions) => void;
  retry: () => unknown;
};
const SORT_LABELS = {
  upcoming_events: "Upcoming events", total_events: "Total associated events", detail_views: "Detail views",
  rsvp_clicks: "RSVP clicks", ticket_clicks: "Ticket clicks",
};
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "short", day: "numeric" }) : "Unavailable";
}
function Unavailable({ title, retry }: { title: string; retry: () => unknown }) {
  return <div className="admin-analytics-page__state"><p>{title} is unavailable.</p>
    <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry {title.toLowerCase()}</button></div>;
}
function Loading({ title }: { title: string }) {
  return <div className="entity-intelligence__loading" aria-busy="true">
    <p role="status">Loading {title.toLowerCase()}…</p>
    <div className="admin-skeleton" aria-hidden="true" />
    <div className="admin-skeleton" aria-hidden="true" />
    <div className="admin-skeleton" aria-hidden="true" />
  </div>;
}
function NumericCell({ label, value }: { label: string; value: number | null }) {
  return <td className="entity-intelligence__number"><span className="entity-intelligence__mobile-label" aria-hidden="true">{label}</span>
    <span>{value === null ? "Unavailable" : value.toLocaleString()}</span></td>;
}
function Relationships({ row, organizer }: { row: EntityPerformanceRow; organizer: boolean }) {
  return <details className="entity-intelligence__relationships">
    <summary>Collaborations and {organizer ? "metros" : "dance styles"}</summary>
    <p>{organizer ? "Associated venues" : "Associated organizers"}: {row.related_total ?? "Unavailable"}.</p>
    {row.related === null ? <p>Collaboration data is unavailable.</p> : row.related.length === 0 ? <p>No canonical collaborators are associated.</p> : <>
      <ul>{row.related.map((item) => <li key={item.id}><Link to={`/admin/${organizer ? "venues" : "organizers"}/${item.id}`}>{item.name}</Link> — {item.event_count} associated events</li>)}</ul>
      <p>Showing {row.related.length} of {row.related_total} canonical collaborators across all stored event statuses.</p>
    </>}
    {organizer ? <>
      <p>Active metros: {row.metro_total ?? "Unavailable"}.</p>
      {row.metros === null ? <p>Active metro relationships are unavailable.</p> : row.metros.length === 0 ? <p>No approved upcoming metro inventory.</p> : <>
        <ul>{row.metros.map((metro) => <li key={metro.slug}><span>{metro.name} ({metro.slug})</span> — {metro.upcoming_events} upcoming events</li>)}</ul>
        <p>Showing {row.metros.length} of {row.metro_total} active metros.</p>
      </>}
    </> : <>
      <p>Dance styles: {row.style_total ?? "Unavailable"}.</p>
      {row.styles === null ? <p>Dance-style relationships are unavailable.</p> : row.styles.length === 0 ? <p>No recorded dance styles on approved associated events.</p> : <>
        <ul>{row.styles.map((style) => <li key={style.slug}>{style.name} — {style.event_count} approved events</li>)}</ul>
        <p>Showing {row.styles.length} of {row.style_total} styles. Multi-style events count once in each associated style.</p>
      </>}
    </>}
  </details>;
}
function Leaderboard({ organizer, source, loading, available, options, onOptionsChange, retry }: {
  organizer: boolean; source: EntityPerformance | null; loading: boolean; available: boolean;
  options: EntityPerformanceOptions; onOptionsChange: Props["onOptionsChange"]; retry: Props["retry"];
}) {
  const plural = organizer ? "organizers" : "venues", singular = organizer ? "Organizer" : "Venue";
  const title = `${singular} intelligence`, sort = organizer ? options.organizerSort : options.venueSort;
  const offset = organizer ? options.organizerOffset : options.venueOffset;
  const changeSort = (value: string) => onOptionsChange(organizer
    ? { ...options, organizerSort: value as OrganizerPerformanceSort, organizerOffset: 0 }
    : { ...options, venueSort: value as VenuePerformanceSort, venueOffset: 0 });
  const changePage = (next: number) => onOptionsChange(organizer
    ? { ...options, organizerOffset: next } : { ...options, venueOffset: next });
  return <section className="admin-card admin-analytics-page__insight-section" aria-labelledby={`entity-${plural}-title`} aria-busy={loading}>
    <h2 id={`entity-${plural}-title`}>{title}</h2>
    <p className="admin-analytics-page__insights-note">Canonical {plural}, including archived entities. Active means approved events scheduled today or later in Eastern time; total and upcoming inventory are independent of the activity period.</p>
    <label className="entity-intelligence__sort">Sort {plural}
      <select className="admin-input" value={sort} onChange={(event) => changeSort(event.target.value)}>
        {Object.entries(SORT_LABELS).filter(([key]) => organizer || key !== "ticket_clicks").map(([key, label]) =>
          <option key={key} value={key} disabled={!available && key !== "upcoming_events" && key !== "total_events"}>{label}</option>)}
      </select>
    </label>
    {loading ? <Loading title={title} /> : !source ? <Unavailable title={title} retry={retry} /> : <>
      <dl className="entity-intelligence__totals">
        <div><dt>Total {plural}</dt><dd>{source.total.toLocaleString()}</dd></div>
        <div><dt>Active {plural}</dt><dd>{source.active.toLocaleString()}</dd></div>
        <div><dt>Created during selected period</dt><dd>{source.created.toLocaleString()}</dd></div>
      </dl>
      {organizer && <p className="admin-analytics-page__insights-note">Last event publication is unavailable: no immutable publication timestamp is recorded. Past occurrence dates are not publication dates.</p>}
      {!available && <p className="admin-analytics-page__insights-note">Recorded engagement is unavailable for this period. Phase 3 must be deployed with recorded history; no historical engagement is inferred.</p>}
      {source.total === 0 ? <p className="admin-analytics-page__state">No canonical {plural} are stored.</p> : source.rows.length === 0 ? <p className="admin-analytics-page__state">No {plural} on this page. Use Previous to return to available results.</p> :
        <table className="entity-intelligence__table">
          <caption className="admin-visually-hidden">{singular} performance</caption>
          <thead><tr><th scope="col">{singular}</th>{!organizer && <th scope="col">City</th>}
            <th scope="col">Upcoming events</th><th scope="col">Total events</th><th scope="col">Created in period</th>
            {available && <><th scope="col">Detail views</th><th scope="col">RSVP clicks</th><th scope="col">Ticket clicks</th><th scope="col">Shares</th></>}
          </tr></thead>
          <tbody>{source.rows.map((row) => <tr key={row.id}>
            <th scope="row" className="entity-intelligence__identity">
              <Link to={`/admin/${plural}/${row.id}`}>{row.name}</Link>
              <p>{row.upcoming_events > 0 ? `Active ${singular.toLowerCase()}` : row.total_events === 0 ? "Without events" : row.past_events === row.total_events ? "Past events only" : "No upcoming events"} · Entity status: {row.status}</p>
              {row.last_occurred_at && <p>Last approved event occurred {dateLabel(row.last_occurred_at)}.</p>}
              {!organizer && <p>Latest scheduled event: {dateLabel(row.latest_scheduled_at)}.</p>}
              <Relationships row={row} organizer={organizer} />
            </th>
            {!organizer && <td><span className="entity-intelligence__mobile-label" aria-hidden="true">City</span>{row.city?.trim() || "Unknown city"}</td>}
            <NumericCell label="Upcoming events" value={row.upcoming_events} /><NumericCell label="Total events" value={row.total_events} />
            <NumericCell label="Created in period" value={row.created_events} />
            {available && <><NumericCell label="Detail views" value={row.engagement?.detail_views ?? null} /><NumericCell label="RSVP clicks" value={row.engagement?.rsvp_clicks ?? null} />
              <NumericCell label="Ticket clicks" value={row.engagement?.ticket_clicks ?? null} /><NumericCell label="Shares" value={row.engagement?.shares ?? null} /></>}
          </tr>)}</tbody>
        </table>}
      {source.total > 0 && <nav className="entity-intelligence__pagination" aria-label={`${singular} ranking pages`}>
        <button type="button" className="admin-btn admin-btn--secondary" aria-label={`Previous ${plural} page`} disabled={offset === 0} onClick={() => changePage(Math.max(0, offset - source.page_size))}>Previous</button>
        <span>{source.rows.length ? `${offset + 1}–${offset + source.rows.length}` : "0"} of {source.total} {plural}</span>
        <button type="button" className="admin-btn admin-btn--secondary" aria-label={`Next ${plural} page`} disabled={offset + source.page_size >= source.total} onClick={() => changePage(offset + source.page_size)}>Next</button>
      </nav>}
    </>}
  </section>;
}
export default function EntityIntelligenceSection({ data, loading, error, options, onOptionsChange, retry }: Props) {
  const coverage = data?.coverage, quality = data?.quality;
  return <div className="entity-intelligence" aria-label="Entity and operational intelligence">
    {error && <div className="admin-banner admin-banner--error" role="alert"><p>{error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry entity intelligence</button></div>}
    <Leaderboard organizer source={data?.organizers ?? null} loading={loading} available={Boolean(data?.engagementAvailable)} options={options} onOptionsChange={onOptionsChange} retry={retry} />
    <Leaderboard organizer={false} source={data?.venues ?? null} loading={loading} available={Boolean(data?.engagementAvailable)} options={options} onOptionsChange={onOptionsChange} retry={retry} />
    {data?.engagementAvailable && <p className="admin-analytics-page__insights-note">Engagement counts recorded actions during the selected period, not confirmed registrations, purchases or unique visitors. Earliest retained interaction: {dateLabel(data.firstRecordedAt)}; earlier history is unavailable. Current canonical associations determine attribution.</p>}
    <section className="admin-card admin-analytics-page__insight-section" aria-labelledby="entity-coverage-title" aria-busy={loading}>
      <h2 id="entity-coverage-title">Geographic coverage</h2>
      <p className="admin-analytics-page__insights-note">Current approved upcoming inventory across the canonical metro registry, including zero-inventory metros. Low inventory: fewer than 3 events. Limited organizer participation: fewer than 2 canonical organizers in a metro with events. Missing associations can reduce participation counts.</p>
      {loading ? <Loading title="Geographic coverage" /> : !coverage ? <Unavailable title="Geographic coverage" retry={retry} /> : <>
        <p className="admin-analytics-page__insights-note">Active metropolitan areas: <strong>{coverage.active_metros}</strong></p>
        {coverage.rows.length === 0 ? <p className="admin-analytics-page__state">No canonical metropolitan areas are stored.</p> : <table className="entity-intelligence__table">
          <caption className="admin-visually-hidden">Metro inventory and participation</caption>
          <thead><tr><th scope="col">Metro</th><th scope="col">Upcoming events</th><th scope="col">Active organizers</th><th scope="col">Active venues</th><th scope="col">Coverage opportunity</th></tr></thead>
          <tbody>{coverage.rows.map((metro) => <tr key={metro.slug}>
            <th scope="row">{metro.city} ({metro.slug})</th><NumericCell label="Upcoming events" value={metro.upcoming_events} />
            <NumericCell label="Active organizers" value={metro.active_organizers} /><NumericCell label="Active venues" value={metro.active_venues} />
            <td><span className="entity-intelligence__mobile-label" aria-hidden="true">Coverage opportunity</span>
              {metro.upcoming_events === 0 ? "No upcoming inventory" : [metro.upcoming_events < 3 ? "Low inventory" : null, metro.active_organizers < 2 ? "Limited organizer participation" : null].filter(Boolean).join("; ") || "No threshold flagged"}
            </td>
          </tr>)}</tbody>
        </table>}
      </>}
      <p className="admin-analytics-page__insights-note">Declining upcoming inventory is unavailable: historical inventory snapshots are not recorded. No geographic health score or stopped-publication claim is inferred.</p>
    </section>
    <section className="admin-card admin-analytics-page__insight-section" aria-labelledby="entity-quality-title" aria-busy={loading}>
      <h2 id="entity-quality-title">Data quality</h2>
      <p className="admin-analytics-page__insights-note">Current records, independent of the activity period. Associations are optional; flyers, discovery metro, dance styles and location/address are recommended. Location/address checks accept canonical venue fallback. Invalid required information means blank title or missing schedule. These checks never modify records.</p>
      {loading ? <Loading title="Data quality" /> : !quality ? <Unavailable title="Data quality" retry={retry} /> : <>
        {quality.every((issue) => issue.count === 0) && <p className="admin-analytics-page__state">No issues found by these checks.</p>}
        <ul className="entity-intelligence__quality">{quality.map((issue) => <li key={issue.key}>
          <div><strong>{QUALITY_LABELS[issue.key]}</strong><span>{issue.count.toLocaleString()} events · {issue.severity === "optional" ? "Optional information" : issue.severity === "recommended" ? "Recommended information" : "Invalid required information"}</span></div>
          {issue.count > 0 && <details><summary>View affected records</summary><ul>{issue.events.map((event) => <li key={event.id}><Link to={`/admin/events?edit=${event.id}`}>{event.title.trim() || "Untitled event"}</Link></li>)}</ul><p>Showing {issue.events.length} of {issue.count} affected events.</p></details>}
        </li>)}</ul>
        <p className="admin-analytics-page__insights-note">Missing venue/organizer: approved events. Missing flyer/location/address/styles: approved upcoming events. Metro/city and required-field checks: all stored events. Record previews are limited to 10 per issue.</p>
      </>}
    </section>
  </div>;
}
