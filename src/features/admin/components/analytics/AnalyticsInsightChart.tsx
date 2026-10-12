import "./AnalyticsInsightChart.css";

export interface AnalyticsInsightChartRow {
  period: string;
  label: string;
  value: number;
}

interface AnalyticsInsightChartProps {
  title: string;
  periodLabel: string;
  rows: AnalyticsInsightChartRow[];
  emptyMessage: string;
}

export default function AnalyticsInsightChart({
  title,
  periodLabel,
  rows,
  emptyMessage,
}: AnalyticsInsightChartProps) {
  if (rows.length === 0) return <p className="admin-analytics-chart__empty">{emptyMessage}</p>;

  let max = 0;
  for (const row of rows) max = Math.max(max, row.value);
  if (max === 0) return <p className="admin-analytics-chart__empty">{emptyMessage}</p>;
  return (
    <div className="admin-analytics-chart" role="region" aria-label={title} tabIndex={0}>
      <table aria-label={title}>
        <thead>
          <tr>
            <th scope="col">{periodLabel}</th>
            <th scope="col">Category</th>
            <th scope="col">Count</th>
            <th scope="col"><span className="admin-analytics-chart__visual-heading">Relative volume</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.period}-${row.label}-${index}`}>
              <th scope="row">{row.period}</th>
              <td>{row.label}</td>
              <td className="admin-analytics-chart__count">{row.value}</td>
              <td>
                <span className="admin-analytics-chart__track" aria-hidden="true">
                  <span
                    className="admin-analytics-chart__bar"
                    style={{ width: `${(row.value / max) * 100}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

