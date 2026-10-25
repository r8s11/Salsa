import { TIME_RANGE_OPTIONS, type TimeRange } from "../../model/analyticsQuery";
import "./AdminAnalyticsFilters.css";

interface AdminAnalyticsFiltersProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

export default function AdminAnalyticsFilters({ range, onRangeChange }: AdminAnalyticsFiltersProps) {
  return (
    <div className="admin-analytics-filters">
      <label className="admin-analytics-filters__label" htmlFor="admin-analytics-period">
        Activity period
      </label>
      <select
        id="admin-analytics-period"
        className="admin-input admin-analytics-filters__select"
        value={range}
        onChange={(event) => onRangeChange(event.target.value as TimeRange)}
      >
        {TIME_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
