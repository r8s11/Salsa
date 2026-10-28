import { Link } from "react-router-dom";
import { coveragePercent, usualNight, type Coverage } from "../../model/coverage";
import { operationalDate } from "../../model/operationalAnalytics";
import "./OperationalInsights.css";

interface Props { data: Coverage | null; loading: boolean; error: string | null; retry: () => void }

function percentLabel(listed: number, tracked: number): string {
  const percent = coveragePercent(listed, tracked);
  return percent === null ? "No score" : `${percent}%`;
}

/**
 * Recurring coverage: whether the recurring nights the guide already knows
 * about are listed for the coming days. A night that stops being imported
 * shows up here as a gap before dancers find an empty calendar.
 */
export default function CoverageSection({ data, loading, error, retry }: Props) {
  const metroName = (name: string | null, slug: string | null) => name ?? slug ?? "No metro assigned";
  return (
    <div className="operational-insights">
      <section className="admin-card" aria-labelledby="coverage-title" aria-busy={loading}>
        <h2 id="coverage-title">Recurring coverage</h2>
        <p className="operational-insights__note">
          {data
            ? `Recurring nights that happened at least ${data.minimumOccurrences} times in the last ${data.lookbackDays} days, and whether each has an approved listing in the next ${data.horizonDays} days.`
            : "Recurring nights from recent weeks, and whether each has an approved listing in the coming days."}{" "}
          A recurring night is a linked series, or the same title at the same venue on the same weekday.
          This is current state, so the reporting period does not apply. It shows whether known nights stay listed, not how much of a city&rsquo;s scene is known.
        </p>
        {error && (
          <div role="alert" className="admin-banner admin-banner--error">
            <p>{error}</p>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Retry coverage</button>
          </div>
        )}
        {loading ? (
          <div role="status" className="operational-insights__loading">
            Loading recurring coverage…<div className="admin-skeleton" aria-hidden="true" />
          </div>
        ) : data && (data.tracked === 0 ? (
          <p>No recurring nights yet. A night needs {data.minimumOccurrences} approved occurrences in the last {data.lookbackDays} days to be tracked.</p>
        ) : (
          <>
            <dl className="operational-insights__stats">
              <div><dt>Coverage, all metros</dt><dd>{percentLabel(data.listed, data.tracked)}</dd></div>
              <div><dt>Listed in the next {data.horizonDays} days</dt><dd>{data.listed} of {data.tracked}</dd></div>
              <div><dt>Missing a listing</dt><dd>{data.tracked - data.listed}</dd></div>
            </dl>
            <table className="operational-insights__table">
              <caption className="admin-visually-hidden">Recurring coverage by metro</caption>
              <thead><tr><th scope="col">Metro</th><th scope="col">Coverage</th><th scope="col">Listed</th><th scope="col">Missing</th></tr></thead>
              <tbody>
                {data.metros.map((metro) => (
                  <tr key={metro.slug ?? "unassigned"}>
                    <th scope="row">{metroName(metro.name, metro.slug)}</th>
                    <td><span className="operational-insights__mobile-label" aria-hidden="true">Coverage</span><span>{percentLabel(metro.listed, metro.tracked)}</span></td>
                    <td><span className="operational-insights__mobile-label" aria-hidden="true">Listed</span><span>{metro.listed} of {metro.tracked}</span></td>
                    <td><span className="operational-insights__mobile-label" aria-hidden="true">Missing</span><span>{metro.tracked - metro.listed}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.metros.filter((metro) => metro.gaps.length > 0).map((metro) => {
              const id = `coverage-gaps-${metro.slug ?? "unassigned"}`;
              const missing = metro.tracked - metro.listed;
              return (
                <section key={id} id={id} aria-labelledby={`${id}-title`} className="operational-insights__detail">
                  <details>
                    <summary><h3 id={`${id}-title`}>Missing in {metroName(metro.name, metro.slug)} ({missing})</h3></summary>
                    <div className="operational-insights__detail-body">
                      <table className="operational-insights__table">
                        <caption className="admin-visually-hidden">Recurring nights without an upcoming listing in {metroName(metro.name, metro.slug)}</caption>
                        <thead><tr><th scope="col">Night</th><th scope="col">Venue</th><th scope="col">Usually</th><th scope="col">Last listed</th></tr></thead>
                        <tbody>
                          {metro.gaps.map((gap) => (
                            <tr key={gap.key}>
                              <th scope="row">
                                {gap.seriesSlug
                                  ? <Link className="operational-insights__link" to={`/series/${gap.seriesSlug}`}>{gap.title}</Link>
                                  : gap.title}
                                <small>{gap.recentOccurrences} in the last {data.lookbackDays} days</small>
                              </th>
                              <td><span className="operational-insights__mobile-label" aria-hidden="true">Venue</span><span>{gap.place ?? "Unavailable"}</span></td>
                              <td><span className="operational-insights__mobile-label" aria-hidden="true">Usually</span><span>{usualNight(gap.lastAt)}</span></td>
                              <td><span className="operational-insights__mobile-label" aria-hidden="true">Last listed</span><span>{operationalDate(gap.lastAt)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {metro.gaps.length < missing && (
                        <p className="operational-insights__note">Showing the {metro.gaps.length} most recently listed of {missing}.</p>
                      )}
                    </div>
                  </details>
                </section>
              );
            })}
            <Link className="admin-btn admin-btn--secondary" to="/admin/events">Review event inventory</Link>
          </>
        ))}
      </section>
    </div>
  );
}
