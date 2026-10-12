import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, CalendarClock, Users, UserCheck, FileText } from "lucide-react";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminMetricCard from "../components/analytics/AdminMetricCard";
import AdminAnalyticsFilters from "../components/analytics/AdminAnalyticsFilters";
import AnalyticsInsightChart from "../components/analytics/AnalyticsInsightChart";
import EntityIntelligenceSection from "../components/analytics/EntityIntelligenceSection";
import OperationalInsights from "../components/analytics/OperationalInsights";
import AnalyticsReporting from "../components/analytics/AnalyticsReporting";
import { INITIAL_OFFSETS, type OperationOffsets } from "../model/operationalAnalytics";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import {
  growthPercentage,
  DEFAULT_ENTITY_OPTIONS,
  type EntityPerformanceOptions,
  TIME_RANGE_OPTIONS,
  type AnalyticsEngagement,
  type AnalyticsInsights,
  type EngagementSort,
  type TimeRange,
} from "../model/analyticsQuery";
import "./AdminAnalyticsPage.css";
export default function AdminAnalyticsPage() {
  const [engagementSort, setEngagementSort] = useState<EngagementSort>("detail_views");
  const [entityOptions, setEntityOptions] = useState<EntityPerformanceOptions>(DEFAULT_ENTITY_OPTIONS);
  const [searchParams, setSearchParams] = useSearchParams();
  const rangeParam = searchParams.get("range");
  const range: TimeRange = TIME_RANGE_OPTIONS.some((option) => option.value === rangeParam)
    ? (rangeParam as TimeRange)
    : "30d";
  const [operationPages, setOperationPages] = useState<{ range: TimeRange; offsets: OperationOffsets }>({ range, offsets: INITIAL_OFFSETS });
  const operationOffsets = operationPages.range === range ? operationPages.offsets : INITIAL_OFFSETS;
  const {
    metrics,
    cities,
    asOf,
    isLoading,
    isFetching,
    error,
    refetch,
    insights,
    insightsLoading,
    insightsError,
    engagement,
    engagementLoading,
    engagementError,
    entityPerformance,
    entitiesLoading,
    entitiesError,
    operations,
    operationsLoading,
    operationsError,
  } = useAdminAnalytics(range, engagementSort, entityOptions, operationOffsets);
  let maxCityCount = 0;
  const cityNameCounts = new Map<string, number>();
  for (const city of cities ?? []) {
    maxCityCount = Math.max(maxCityCount, city.count);
    cityNameCounts.set(city.city, (cityNameCounts.get(city.city) ?? 0) + 1);
  }

  const handleRangeChange = (nextRange: TimeRange) => {
    setEntityOptions((current) => ({ ...current, organizerOffset: 0, venueOffset: 0 }));
    const next = new URLSearchParams(searchParams);
    next.set("range", nextRange);
    next.delete("from");
    next.delete("to");
    next.delete("granularity");
    setSearchParams(next);
  };

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Platform activity, event inventory, and recorded event engagement."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-analytics-page__refresh"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      <AdminAnalyticsFilters range={range} onRangeChange={handleRangeChange} />
      <AnalyticsReporting
        key={`${range}-${engagementSort}-${entityOptions.organizerSort}-${entityOptions.venueSort}`}
        period={range} engagementSort={engagementSort} entityOptions={entityOptions}
      />
      <OperationalInsights
        data={operations ?? null} loading={Boolean(operationsLoading)} error={operationsError ?? null}
        offsets={operationOffsets} onOffsetsChange={(offsets) => setOperationPages({ range, offsets })}
        retry={() => refetch()}
      />

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Retry analytics
          </button>
        </div>
      )}

      <section aria-labelledby="admin-analytics-activity-title">
        <div className="admin-analytics-page__section-heading">
          <h2 id="admin-analytics-activity-title">Activity during selected period</h2>
          <p>Events, accounts, and submissions created during the selected activity period.</p>
        </div>
        <div className="admin-analytics-page__metrics-grid">
          {ACTIVITY_METRICS.map((config) => (
            <AdminMetricCard
              key={config.key}
              label={config.label}
              value={isLoading ? null : (metrics?.[config.key] ?? null)}
              subLabel={metrics?.[config.key] === null ? "Unable to load this metric. Please try again." : config.subLabel}
              icon={config.icon}
              tone="informational"
              isLoading={isLoading}
              onRetry={() => refetch()}
            />
          ))}
        </div>
        {!isLoading && !error && metrics?.total_events === 0 && (
          <p className="admin-analytics-page__state">No events were created during this period.</p>
        )}
      </section>

      <section aria-labelledby="admin-analytics-current-title">
        <div className="admin-analytics-page__section-heading">
          <h2 id="admin-analytics-current-title">Current platform state</h2>
          <p>
            Upcoming events and active organizers are approved inventory today or later in
            America/New_York. These counts and the city distribution are independent of the
            selected activity period.
          </p>
        </div>
        <div className="admin-analytics-page__metrics-grid admin-analytics-page__metrics-grid--current">
          {CURRENT_METRICS.map((config) => (
            <AdminMetricCard
              key={config.key}
              label={config.label}
              value={isLoading ? null : (metrics?.[config.key] ?? null)}
              subLabel={metrics?.[config.key] === null ? "Unable to load this metric. Please try again." : config.subLabel}
              icon={config.icon}
              tone="informational"
              isLoading={isLoading}
              onRetry={() => refetch()}
            />
          ))}
        </div>
        <section
          className="admin-card admin-analytics-page__city-card"
          aria-label="Events by City"
          aria-busy={isLoading}
        >
          <h3>Events by City</h3>
          {isLoading ? (
            <p className="admin-analytics-page__state" role="status">
              Loading city distribution…
            </p>
          ) : cities === null ? (
            <div className="admin-analytics-page__state">
              <p>City data is unavailable.</p>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => refetch()}
              >
                Retry city data
              </button>
            </div>
          ) : cities.length === 0 ? (
            <p className="admin-analytics-page__state">No approved events are scheduled for today or later.</p>
          ) : (
            <ul className="admin-analytics-page__city-list">
              {cities.map(({ slug, city, count }) => {
                const label = (cityNameCounts.get(city) ?? 0) > 1 && slug ? `${city} (${slug})` : city;
                return (
                  <li
                    className="admin-analytics-page__city-row"
                    key={slug ?? ""}
                    aria-label={`${label}: ${count} events`}
                  >
                    <span className="admin-analytics-page__city-name">{label}</span>
                    <span className="admin-analytics-page__city-track" aria-hidden="true">
                      <span
                        className="admin-analytics-page__city-bar"
                        style={{ width: `${(count / Math.max(maxCityCount, 1)) * 100}%` }}
                      />
                    </span>
                    <span className="admin-analytics-page__city-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <p className="admin-analytics-page__as-of">
          {asOf
            ? `Data as of ${new Date(asOf).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}`
            : "Data update time unavailable."}
        </p>
      </section>

      <section className="admin-analytics-page__insights" aria-label="Additional analytics">
        <p className="admin-analytics-page__insights-note">
          The selected period scopes event/account creation and submission cohorts, not current upcoming inventory.
          First and last finite-window buckets may be partial. All-time totals include rows with missing source
          timestamps, but those rows do not receive manufactured series buckets.
        </p>
        <GrowthSection insights={insights} loading={insightsLoading} retry={refetch} range={range} />
        <SubmissionsSection insights={insights} loading={insightsLoading} retry={refetch} />
        <GeographySection insights={insights} loading={insightsLoading} retry={refetch} />
        <StylesSection insights={insights} loading={insightsLoading} retry={refetch} />
        {insightsError && (
          <p className="admin-analytics-page__insights-note" role="status">
            Some insight data is unavailable. Healthy sections remain available.
          </p>
        )}
      </section>
      <EngagementSection
        engagement={engagement}
        loading={engagementLoading}
        error={engagementError}
        retry={() => refetch()}
        sort={engagementSort}
        onSortChange={setEngagementSort}
      />
      <EntityIntelligenceSection
        data={entityPerformance ?? null}
        loading={Boolean(entitiesLoading)}
        error={entitiesError ?? null}
        options={entityOptions}
        onOptionsChange={setEntityOptions}
        retry={() => refetch()}
      />
    </>
  );
}

function GrowthSection({
  insights,
  loading,
  retry,
  range,
}: InsightSectionProps & { range: TimeRange }) {
  const events = insights?.events;
  const users = insights?.users;
  return (
    <InsightSection title="Growth" loading={loading} retry={retry} available={Boolean(insights)}>
      {insights && (
        <>
          <p className="admin-analytics-page__insights-note">
            {granularityLabel(insights.granularity)} buckets. Event approval and pending/draft counts reflect
            each cohort’s current status, not historical status at creation.
          </p>
          <div className="admin-analytics-page__growth-grid">
            {events ? (
              <article className="admin-analytics-page__insight-block">
                <h3>Event growth</h3>
                <p className="admin-analytics-page__total">{events.current}</p>
                <p className="admin-analytics-page__insights-note">Events created in {range === "all" ? "all time" : `the last ${range.slice(0, -1)} days`}.</p>
                <Comparison current={events.current} previous={events.previous} range={range} />
                <AnalyticsInsightChart
                  title={`${granularityLabel(insights.granularity)} event growth`}
                  periodLabel={periodLabel(insights.granularity)}
                  rows={events.series.flatMap((row) => [
                    { period: row.period, label: "Created", value: row.created },
                    { period: row.period, label: "Currently approved", value: row.approved },
                    { period: row.period, label: "Currently pending or draft", value: row.pending_draft },
                  ])}
                  emptyMessage="No event creation buckets in this period."
                />
              </article>
            ) : (
              <UnavailableInline title="Event growth" retry={retry} />
            )}
            {users ? (
              <article className="admin-analytics-page__insight-block">
                <h3>Account growth</h3>
                <p className="admin-analytics-page__total">{users.current}</p>
                <p className="admin-analytics-page__insights-note">
                  Accounts created in {range === "all" ? "all time" : `the last ${range.slice(0, -1)} days`}. All accounts: {users.total_accounts}.
                </p>
                <Comparison current={users.current} previous={users.previous} range={range} />
                <AnalyticsInsightChart
                  title={`${granularityLabel(insights.granularity)} account growth`}
                  periodLabel={periodLabel(insights.granularity)}
                  rows={users.series.map((row) => ({ period: row.period, label: "Accounts created", value: row.count }))}
                  emptyMessage="No account creation buckets in this period."
                />
              </article>
            ) : (
              <UnavailableInline title="Account growth" retry={retry} />
            )}
          </div>
        </>
      )}
    </InsightSection>
  );
}

function UnavailableInline({ title, retry }: { title: string; retry: () => void }) {
  return (
    <div className="admin-analytics-page__state">
      <p>{title} data is unavailable.</p>
      <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>
        Retry {title.toLowerCase()}
      </button>
    </div>
  );
}

function SubmissionsSection({ insights, loading, retry }: InsightSectionProps) {
  const submissions = insights?.submissions;
  if (!submissions) {
    return <InsightSection title="Event submissions" loading={loading} retry={retry} available={false} />;
  }
  const reviewed = submissions.approved + submissions.rejected;
  const approvalRate = reviewed === 0 ? null : (submissions.approved / reviewed) * 100;
  return (
    <InsightSection title="Event submissions" loading={loading} retry={retry} available>
      <p className="admin-analytics-page__insights-note">
        Selected submission cohort, grouped by submitted date; counts below use each submission’s current status.
        No immutable review-history timeline is available.
      </p>
      <div className="admin-analytics-page__status-grid">
        <StatusValue label="Received" value={submissions.received} />
        <StatusValue label="Approved" value={submissions.approved} />
        <StatusValue label="Rejected" value={submissions.rejected} />
        <StatusValue label="Pending or in review" value={submissions.pending} />
        <StatusValue label="Needs information" value={submissions.needs_information} />
        <StatusValue label="Withdrawn" value={submissions.withdrawn} />
        <StatusValue
          label={`Approval rate (${submissions.approved} of ${reviewed} reviewed)`}
          value={approvalRate === null ? "Unavailable" : `${Math.round(approvalRate)}%`}
        />
      </div>
      <AnalyticsInsightChart
        title={`${granularityLabel(insights?.granularity ?? "daily")} submission activity`}
        periodLabel={periodLabel(insights?.granularity ?? "daily")}
        rows={submissions.series.map((row) => ({ period: row.period, label: "Submissions received", value: row.count }))}
        emptyMessage="No submissions were received in this period."
      />
    </InsightSection>
  );
}

function GeographySection({ insights, loading, retry }: InsightSectionProps) {
  const geography = insights?.geography;
  if (!geography) {
    return <InsightSection title="Geography" loading={loading} retry={retry} available={false} />;
  }
  const cityNames = new Map<string, Set<string | null>>();
  for (const { city, slug } of geography.scheduled) {
    let identities = cityNames.get(city);
    if (!identities) cityNames.set(city, identities = new Set());
    identities.add(slug);
  }
  return (
    <InsightSection title="Geography" loading={loading} retry={retry} available>
      <p className="admin-analytics-page__total">{geography.active_metros} active metros</p>
      <p className="admin-analytics-page__insights-note">
        Active means a registered metro has at least one currently approved event scheduled today or later.
      </p>
      <h3>Emerging metros</h3>
      {geography.emerging.length === 0 ? (
        <p className="admin-analytics-page__state">No active metros were first observed in this period.</p>
      ) : (
        <ul className="admin-analytics-page__emerging-list">
          {geography.emerging.map((metro) => (
            <li key={metro.slug}>
              <strong>{metro.city}</strong>
              <span>{metro.upcoming} upcoming events</span>
              <span>First observed {formatDate(metro.first_created_at)}.</span>
            </li>
          ))}
        </ul>
      )}
      <p className="admin-analytics-page__insights-note">
        “Emerging” means currently active metros whose earliest creation timestamp among currently approved events falls in this period.
        “First observed” is not a historical activation date. Scheduled trend groups currently approved events by event date,
        including past dates; it is not a historical inventory snapshot.
        {geography.inventory_history_available
          ? ""
          : " Inventory history is unavailable, so changes in scheduled inventory over time cannot be inferred."}
      </p>
      <AnalyticsInsightChart
        title={`${granularityLabel(insights?.granularity ?? "daily")} current approved events by city`}
        periodLabel={periodLabel(insights?.granularity ?? "daily")}
        rows={geography.scheduled.map((row) => ({
          period: row.period,
          label: (cityNames.get(row.city)?.size ?? 0) > 1 && row.slug ? `${row.city} (${row.slug})` : row.city,
          value: row.count,
        }))}
        emptyMessage="No currently approved events in this event-date range."
      />
    </InsightSection>
  );
}

function StylesSection({ insights, loading, retry }: InsightSectionProps) {
  const styles = insights?.styles;
  if (!styles) {
    return <InsightSection title="Dance styles" loading={loading} retry={retry} available={false} />;
  }
  return (
    <InsightSection title="Dance styles" loading={loading} retry={retry} available>
      <p className="admin-analytics-page__insights-note">
        Share of {styles.upcoming_total} upcoming events (approved events scheduled today or later). Events with
        multiple styles count once in each assigned style; shares can total more than 100%.
      </p>
      {styles.upcoming_total === 0 || styles.distribution.length === 0 ? (
        <p className="admin-analytics-page__state">No approved upcoming events have dance styles to report.</p>
      ) : (
        <ul className="admin-analytics-page__style-list">
          {styles.distribution.map(({ slug, style, count }) => {
            const percentage = (count / styles.upcoming_total) * 100;
            const percentageLabel = percentage > 0 && percentage < 0.1
              ? "<0.1%" : `${percentage.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
            return (
              <li key={slug ?? "unspecified"} aria-label={`${style}: ${count} events, ${percentageLabel}`}>
                <span>{style}</span>
                <span className="admin-analytics-page__style-track" aria-hidden="true">
                  <span style={{ width: `${Math.min(percentage, 100)}%` }} />
                </span>
                <span>{count}</span>
                <strong>{percentageLabel}</strong>
              </li>
            );
          })}
        </ul>
      )}
      <AnalyticsInsightChart
        title={`${granularityLabel(insights?.granularity ?? "daily")} current approved events by dance style`}
        periodLabel={periodLabel(insights?.granularity ?? "daily")}
        rows={styles.scheduled.map((row) => ({ period: row.period, label: row.style, value: row.count }))}
        emptyMessage="No approved event schedule by dance style in this period."
      />
      <p className="admin-analytics-page__insights-note">
        Current approved events are grouped by event date, including past dates. Trend uses current style assignments;
        historical approval and style-assignment snapshots are not retained.
      </p>
    </InsightSection>
  );
}

interface InsightSectionProps {
  insights: AnalyticsInsights | null;
  loading: boolean;
  retry: () => void;
}

function InsightSection({
  title,
  loading,
  retry,
  available,
  children,
}: { loading: boolean; retry: () => void; title: string; available: boolean; children?: ReactNode }) {
  return (
    <section
      className="admin-card admin-analytics-page__insight-section"
      aria-label={title}
      aria-busy={loading}
    >
      <h2>{title}</h2>
      {loading ? (
        <p className="admin-analytics-page__state" role="status">Loading {title.toLowerCase()} insights…</p>
      ) : !available ? (
        <div className="admin-analytics-page__state">
          <p>{title} insights are unavailable.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>
            Retry {title.toLowerCase()}
          </button>
        </div>
      ) : children}
    </section>
  );
}

function StatusValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="admin-analytics-page__status-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Comparison({
  current,
  previous,
  range,
}: {
  current: number;
  previous: number | null;
  range: TimeRange;
}) {
  if (range === "all" || previous === null) {
    return <p className="admin-analytics-page__comparison">Previous period unavailable.</p>;
  }
  if (previous === 0) {
    return <p className="admin-analytics-page__comparison">Previous period: 0; percentage change unavailable.</p>;
  }
  const percentage = growthPercentage(current, previous);
  return (
    <p className="admin-analytics-page__comparison">
      Previous equivalent period: {previous}; change {percentage === null ? "unavailable" : `${percentage > 0 ? "+" : ""}${Math.round(percentage)}%`}.
    </p>
  );
}

function granularityLabel(granularity: AnalyticsInsights["granularity"]) {
  return granularity === "daily" ? "Daily" : granularity === "weekly" ? "Weekly" : "Monthly";
}

function periodLabel(granularity: AnalyticsInsights["granularity"]) {
  return granularity === "daily" ? "Date" : granularity === "weekly" ? "Week of" : "Month of";
}


function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ACTIVITY_METRICS: {
  key: "total_events" | "registered_users" | "pending_submissions";
  label: string;
  subLabel: string;
  icon: typeof CalendarDays;
}[] = [
  {
    key: "total_events",
    label: "Total Events",
    subLabel: "Events created during the selected activity period.",
    icon: CalendarDays,
  },
  {
    key: "registered_users",
    label: "Registered Users",
    subLabel: "Accounts created during the selected activity period.",
    icon: Users,
  },
  {
    key: "pending_submissions",
    label: "Pending Submissions",
    subLabel: "Pending and in review, submitted during the selected activity period.",
    icon: FileText,
  },
];

const CURRENT_METRICS: {
  key: "upcoming_events" | "active_organizers";
  label: string;
  subLabel: string;
  icon: typeof CalendarDays;
}[] = [
  {
    key: "upcoming_events",
    label: "Upcoming Events",
    subLabel: "Approved events today or later in America/New_York.",
    icon: CalendarClock,
  },
  {
    key: "active_organizers",
    label: "Active Organizers",
    subLabel: "Organizers with approved upcoming events.",
    icon: UserCheck,
  },
];

function EngagementSection({
  engagement,
  loading,
  error,
  retry,
  sort,
  onSortChange,
}: {
  engagement: AnalyticsEngagement | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  sort: EngagementSort;
  onSortChange: (sort: EngagementSort) => void;
}) {
  const summary = engagement?.summary ?? null;
  const events = engagement?.events ?? null;
  const metros = engagement?.metros ?? null;
  const styles = engagement?.styles ?? null;
  const maxima = {
    metro: Math.max(1, ...(metros ?? []).map((row) => row.detail_views)),
    style: Math.max(1, ...(styles ?? []).map((row) => row.detail_views)),
  };
  return (
    <section className="admin-analytics-page__engagement" aria-labelledby="admin-analytics-engagement-title" aria-busy={loading}>
      <div className="admin-analytics-page__section-heading">
        <h2 id="admin-analytics-engagement-title">Event engagement</h2>
        <p>Interactions recorded during the selected period, attributed to the event’s city and current dance styles.</p>
      </div>
      <label className="admin-analytics-page__sort">
        Rank by
        <select value={sort} onChange={(event) => onSortChange(event.target.value as EngagementSort)}>
          <option value="detail_views">Detail views</option>
          <option value="rsvp_clicks">RSVP clicks</option>
          <option value="ticket_clicks">Ticket clicks</option>
          <option value="shares">Shares</option>
        </select>
      </label>
      {loading ? <p className="admin-analytics-page__state" role="status">Loading engagement analytics…</p>
        : error ? <div className="admin-analytics-page__state" role="alert"><p>{error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry engagement data</button></div>
          : !engagement ? <p className="admin-analytics-page__state">Engagement data is unavailable.</p>
            : engagement.firstRecordedAt === null && summary?.detail_views === 0
              && events?.length === 0 && metros?.length === 0 && styles?.length === 0
                ? <p className="admin-analytics-page__state">Engagement tracking has no recorded history yet. Activity before tracking was enabled is unavailable.</p>
                : (
                <>
                  {summary ? (
                    <div className="admin-analytics-page__engagement-summary" aria-label="Interaction totals">
                      <Metric label="Detail views" value={summary.detail_views} />
                      <Metric label="RSVP clicks" value={summary.rsvp_clicks} />
                      <Metric label="Ticket clicks" value={summary.ticket_clicks} />
                      <Metric label="Shares" value={summary.shares} />
                      <Metric label="Saves" value="Unavailable" />
                    </div>
                  ) : <UnavailableInline title="Interaction totals" retry={retry} />}
                  <h3>Engagement funnel</h3>
                  <p className="admin-analytics-page__insights-note">
                    {summary ? `${summary.detail_views} detail views → ${summary.outbound_clicks} outbound RSVP / ticket clicks` : "Funnel totals unavailable."}
                    {" "}Outbound actions are clicks, not confirmed registrations, purchases, or attendance. Event saving is not supported.
                  </p>
                  <p className="admin-analytics-page__insights-note">
                    Outbound click-to-view ratio: {summary?.click_to_view_ratio === null || !summary ? "Unavailable" : `${summary.click_to_view_ratio}%`}.
                    {" "}This is RSVP plus ticket clicks divided by detail-view events, not unique visitors; values may exceed 100%.
                  </p>
                  <div className="admin-analytics-page__engagement-grid">
                    <section className="admin-card admin-analytics-page__engagement-panel" aria-labelledby="engagement-events-title">
                      <h3 id="engagement-events-title">Event performance</h3>
                      {events === null ? <UnavailableInline title="Event rankings" retry={retry} />
                        : events.length === 0 ? <p className="admin-analytics-page__state">No tracked event interactions in this period.</p>
                          : <ul className="admin-analytics-page__engagement-events">{events.map((event) => (
                            <li key={event.id}>
                              <Link to={`/admin/events?edit=${encodeURIComponent(event.id)}`}>{event.title}</Link>
                              <span>{event.event_date ? formatDate(event.event_date) : "Date unavailable"} · {event.city} · {event.status}</span>
                              <span>{event.detail_views} views · {event.rsvp_clicks} RSVP · {event.ticket_clicks} tickets · {event.shares} shares</span>
                            </li>
                          ))}</ul>}
                    </section>
                    <section className="admin-card admin-analytics-page__engagement-panel" aria-labelledby="engagement-metros-title">
                      <h3 id="engagement-metros-title">Engagement with events by city</h3>
                      {metros === null ? <UnavailableInline title="City engagement" retry={retry} />
                        : metros.length === 0 ? <p className="admin-analytics-page__state">No city engagement in this period.</p>
                          : <ul className="admin-analytics-page__engagement-bars">{metros.map((row) => (
                            <li key={row.slug ?? "unknown"} aria-label={`${row.city}: ${row.detail_views} detail views, ${row.rsvp_clicks} RSVP clicks, ${row.shares} shares`}>
                              <span>{row.city}</span><span className="admin-analytics-page__engagement-track" aria-hidden="true"><span style={{ width: `${row.detail_views / maxima.metro * 100}%` }} /></span>
                              <strong>{row.detail_views} views · {row.rsvp_clicks} RSVP · {row.shares} shares</strong>
                            </li>
                          ))}</ul>}
                    </section>
                    <section className="admin-card admin-analytics-page__engagement-panel" aria-labelledby="engagement-styles-title">
                      <h3 id="engagement-styles-title">Engagement by dance style</h3>
                      <p>Events with multiple styles contribute once to each linked style; totals overlap.</p>
                      {styles === null ? <UnavailableInline title="Dance-style engagement" retry={retry} />
                        : styles.length === 0 ? <p className="admin-analytics-page__state">No dance-style engagement in this period.</p>
                          : <ul className="admin-analytics-page__engagement-bars">{styles.map((row) => (
                            <li key={row.slug ?? row.style} aria-label={`${row.style}: ${row.detail_views} detail views, ${row.rsvp_clicks} RSVP clicks, ${row.shares} shares`}>
                              <span>{row.style}</span><span className="admin-analytics-page__engagement-track" aria-hidden="true"><span style={{ width: `${row.detail_views / maxima.style * 100}%` }} /></span>
                              <strong>{row.detail_views} views · {row.rsvp_clicks} RSVP · {row.shares} shares</strong>
                            </li>
                          ))}</ul>}
                    </section>
                  </div>
                  {engagement.firstRecordedAt && (
                    <p className="admin-analytics-page__insights-note">Observed interaction history begins no earlier than {formatDate(engagement.firstRecordedAt)}; this is the earliest stored interaction, not a verified collection-start date.</p>
                  )}
                </>
              )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong></div>;
}
