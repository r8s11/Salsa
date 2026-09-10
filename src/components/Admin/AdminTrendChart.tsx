import type { ChartDataPoint } from "../../features/admin/model/analyticsQuery";
import "./AdminTrendChart.css";

interface AdminTrendChartProps {
  label: string;
  data: ChartDataPoint[];
  isLoading: boolean;
}

const MAX_BAR_HEIGHT = 120;
const BAR_WIDTH = 24;
const BAR_GAP = 16;
const CHART_HEIGHT = MAX_BAR_HEIGHT + 30; // bars + label space

export default function AdminTrendChart({ label, data, isLoading }: AdminTrendChartProps) {
  if (isLoading) {
    return (
      <div className="admin-trend-chart" aria-busy="true">
        <h3 className="admin-trend-chart__title">{label}</h3>
        <p role="status" className="admin-trend-chart__loading">
          Loading chart…
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="admin-trend-chart">
        <h3 className="admin-trend-chart__title">{label}</h3>
        <p className="admin-trend-chart__empty">No data for this period.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const chartWidth = data.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP + 40; // +40 for axis labels

  return (
    <div className="admin-trend-chart">
      <h3 className="admin-trend-chart__title">{label}</h3>
      <div
        className="admin-trend-chart__canvas"
        role="img"
        aria-label={`${label} trend chart with ${data.length} data points`}
      >
        <svg
          className="admin-trend-chart__svg"
          width={chartWidth}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-axis grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = CHART_HEIGHT - (pct / 100) * MAX_BAR_HEIGHT - 10;
            return (
              <line
                key={pct}
                x1={20}
                y1={y}
                x2={chartWidth - 10}
                y2={y}
                className="admin-trend-chart__grid-line"
              />
            );
          })}

          {/* Bars */}
          {data.map((point, index) => {
            const barHeight = (point.value / maxValue) * MAX_BAR_HEIGHT;
            const x = 20 + index * (BAR_WIDTH + BAR_GAP);
            const y = CHART_HEIGHT - 10 - barHeight;
            return (
              <g key={index} className="admin-trend-chart__bar-group">
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  className="admin-trend-chart__bar"
                  rx={2}
                />
                <text
                  className="admin-trend-chart__bar-value"
                  x={x + BAR_WIDTH / 2}
                  y={y - 4}
                  textAnchor="middle"
                >
                  {point.value}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {data.map((point, index) => {
            const x = 20 + index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2;
            const y = CHART_HEIGHT - 2;
            return (
              <text
                key={index}
                className="admin-trend-chart__axis-label"
                x={x}
                y={y}
                textAnchor="middle"
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
