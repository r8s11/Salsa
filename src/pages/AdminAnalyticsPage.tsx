import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CalendarDays, Users, Link, FileText } from "lucide-react";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminMetricCard from "../components/Admin/AdminMetricCard";
import AdminAnalyticsFilters from "../components/Admin/AdminAnalyticsFilters";
import AdminTrendChart from "../components/Admin/AdminTrendChart";
import AdminActivityTable from "../components/Admin/AdminActivityTable";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import { useAdminSubmissions } from "../hooks/useAdminSubmissions";
import {
  TIME_RANGE_OPTIONS,
  GRANULARITY_OPTIONS,
  dateRangeFor,
  granularityForRange,
  formatDelta,
  deltaTrend,
  type TimeRange,
  type Granularity,
  type AnalyticsMetrics,
} from "../features/admin/model/analyticsQuery";
import "./AdminAnalyticsPage.css";

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    submissions,
    isLoading: isSubmissionsLoading,
    error: submissionsError,
  } = useAdminSubmissions();

  // Parse URL params
  const rangeParam = searchParams.get("range") as TimeRange | null;
  const granularityParam = searchParams.get("granularity") as Granularity | null;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Resolve time range
  const [range, setRange] = useState<TimeRange>(
    TIME_RANGE_OPTIONS.some((o) => o.value === rangeParam) ? rangeParam! : "30d"
  );

  // Date range — derived from pills OR custom dates
  const defaultRange = dateRangeFor(range);
  const [dateRange, setDateRange] = useState({
    from: fromParam ? new Date(fromParam) : defaultRange.from,
    to: toParam ? new Date(toParam) : defaultRange.to,
  });

  // Granularity
  const defaultGranularity = granularityForRange(range);
  const [granularity, setGranularity] = useState<Granularity>(
    GRANULARITY_OPTIONS.some((o) => o.value === granularityParam)
      ? granularityParam!
      : defaultGranularity
  );

  // Update URL when range/granularity changes
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("range", range);
    next.set("granularity", granularity);
    next.set("from", formatDateForInput(dateRange.from));
    next.set("to", formatDateForInput(dateRange.to));
    setSearchParams(next, { replace: true });
  }, [range, granularity, dateRange, setSearchParams]);

  const handleRangeChange = (next: TimeRange) => {
    setRange(next);
    if (!fromParam && !toParam) setDateRange(dateRangeFor(next));
    setGranularity(granularityForRange(next));
  };
  const handleGranularityChange = (next: Granularity) => setGranularity(next);

  const handleCustomRange = (from: string, to: string) => {
    const f = new Date(from);
    const t = new Date(to);
    setDateRange({
      from: isNaN(f.getTime()) ? dateRange.from : f,
      to: isNaN(t.getTime()) ? dateRange.to : t,
    });
  };

  // Fetch analytics
  const { metrics, series, isLoading, refetch } = useAdminAnalytics(dateRange, granularity);

  const handleMetricCardClick = (key: keyof AnalyticsMetrics) => {
    switch (key) {
      case "published_events":
        navigate("/admin/events?flag=published");
        break;
      case "new_users":
        navigate("/admin/users");
        break;
      case "submissions":
        navigate("/admin/submissions");
        break;
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Platform metrics and growth trends."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Refresh
          </button>
        }
      />

      <AdminAnalyticsFilters
        range={range}
        onRangeChange={handleRangeChange}
        granularity={granularity}
        onGranularityChange={handleGranularityChange}
        dateRange={dateRange}
        fromDate={formatDateForInput(dateRange.from)}
        toDate={formatDateForInput(dateRange.to)}
        onCustomRangeChange={handleCustomRange}
      />

      <div className="admin-analytics-page__metrics-grid">
        {METRIC_CONFIG.map((config) => {
          const metric = metrics?.[config.key];
          const delta = metric?.delta ?? 0;
          const trend = deltaTrend(delta);
          return (
            <div
              key={config.key}
              className="admin-analytics-page__metric-card"
              onClick={() => handleMetricCardClick(config.key)}
            >
              <AdminMetricCard
                label={config.label}
                value={metric?.current ?? null}
                subLabel={
                  metric
                    ? `${formatDelta(delta)} from ${metric.previous} last period`
                    : config.subLabel
                }
                icon={config.icon}
                tone={trend === "up" ? "informational" : "attention"}
                isLoading={isLoading}
              />
            </div>
          );
        })}
      </div>

      <div className="admin-analytics-page__charts">
        <section className="admin-card">
          <AdminTrendChart
            label="Published Events"
            data={series?.events ?? []}
            isLoading={isLoading}
          />
        </section>
        <section className="admin-card">
          <AdminTrendChart
            label="Submissions"
            data={series?.submissions ?? []}
            isLoading={isLoading}
          />
        </section>
      </div>

      <section className="admin-card admin-analytics-page__recent">
        <h2>Recent Submissions</h2>
        {submissionsError ? (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>We couldn&apos;t load recent submissions.</p>
          </div>
        ) : (
          <>
            <AdminActivityTable
              entries={submissions
                .slice()
                .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at))
                .slice(0, 6)
                .map((s) => ({
                  id: s.id,
                  action: `submission.${
                    s.status === "approved"
                      ? "approved"
                      : s.status === "rejected"
                        ? "rejected"
                        : "pending"
                  }`,
                  actor_id: s.submitter_id ?? null,
                  actor_display_name: s.submitter_name ?? null,
                  actor_username: null,
                  actor_avatar_url: null,
                  entity_type: "event_submission",
                  entity_id: s.id,
                  metadata: {
                    title: (s.submitted_data as { title?: string })?.title ?? s.id,
                  },
                  created_at: s.submitted_at,
                }))}
              onViewDetail={(entry) => {
                navigate(`/admin/submissions/${entry.id}`);
              }}
            />
            {submissions.length === 0 && !isSubmissionsLoading && (
              <p className="admin-analytics-page__empty">No recent submissions.</p>
            )}
          </>
        )}
      </section>
    </>
  );
}

const METRIC_CONFIG: {
  key: keyof AnalyticsMetrics;
  label: string;
  subLabel: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  {
    key: "published_events",
    label: "Published Events",
    subLabel: "Approved events in range",
    icon: CalendarDays,
  },
  { key: "new_users", label: "New Users", subLabel: "Registered profiles in range", icon: Users },
  { key: "rsvps", label: "RSVPs", subLabel: "Events with RSVP links", icon: Link },
  {
    key: "submissions",
    label: "Submissions",
    subLabel: "Event submissions in range",
    icon: FileText,
  },
];
