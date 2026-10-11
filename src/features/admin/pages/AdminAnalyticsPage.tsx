import { useSearchParams } from "react-router-dom";
import { CalendarDays, CalendarClock, Users, UserCheck, FileText } from "lucide-react";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminMetricCard from "../components/analytics/AdminMetricCard";
import AdminAnalyticsFilters from "../components/analytics/AdminAnalyticsFilters";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import { TIME_RANGE_OPTIONS, type TimeRange } from "../model/analyticsQuery";
import "./AdminAnalyticsPage.css";

export default function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rangeParam = searchParams.get("range");
  const range: TimeRange = TIME_RANGE_OPTIONS.some((option) => option.value === rangeParam)
    ? (rangeParam as TimeRange)
    : "30d";
  const { metrics, cities, asOf, isLoading, isFetching, error, refetch } =
    useAdminAnalytics(range);
  let maxCityCount = 0;
  const cityNameCounts = new Map<string, number>();
  for (const city of cities ?? []) {
    maxCityCount = Math.max(maxCityCount, city.count);
    cityNameCounts.set(city.city, (cityNameCounts.get(city.city) ?? 0) + 1);
  }

  const handleRangeChange = (nextRange: TimeRange) => {
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
        description="Creation activity and current platform inventory."
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
    </>
  );
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
