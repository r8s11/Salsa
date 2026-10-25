import { Link, useSearchParams } from "react-router-dom";
import { useAdminEntityDirectory } from "../hooks/useAdminEntities";
import { ENTITY_LABELS, qualityIssueLabel, type EntityKind, type EntityStatus } from "../model";
import "./AdminEntityPages.css";

const STATUS_OPTIONS: { value: EntityStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "needs_review", label: "Needs review" },
  { value: "archived", label: "Archived" },
  { value: "suspended", label: "Suspended" },
];

export default function AdminEntityDirectoryPage({ kind }: { kind: EntityKind }) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const requestedStatus = params.get("status") ?? "";
  const supportedStatuses = kind === "organizer"
    ? ["active", "needs_review", "archived", "suspended"]
    : ["active", "needs_review", "archived"];
  const status = supportedStatuses.includes(requestedStatus)
    ? requestedStatus as EntityStatus
    : null;
  const { rows, isLoading, error, refetch } = useAdminEntityDirectory(kind, query, status);
  const labels = ENTITY_LABELS[kind];
  const plural = labels.plural.toLowerCase();
  const basePath = `/admin/${kind === "series" ? "series" : kind === "organizer" ? "organizers" : `${kind}s`}`;
  const change = (key: "q" | "status", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const filtered = Boolean(query || status);
  const list = rows ?? [];
  const needsReview = list.filter((row) => row.status === "needs_review").length;
  const flagged = list.filter((row) => row.quality_issues.length > 0).length;

  return (
    <div className="admin-entity-page">
      <header className="admin-entity-page__header">
        <div>
          <h1>{labels.plural}</h1>
          {!isLoading && !error && list.length > 0 ? (
            <p className="admin-entity-page__tally">
              {list.length} {list.length === 1 ? labels.singular.toLowerCase() : plural}
              {filtered ? " matching" : ""} · {needsReview} need review · {flagged} with quality flags
            </p>
          ) : null}
        </div>
        <Link className="admin-btn admin-btn--primary" to={`${basePath}/new`}>Create {labels.singular.toLowerCase()}</Link>
      </header>
      {error ? <div className="admin-banner admin-banner--error" role="alert"><p>Could not load {plural}: {error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>Try again</button></div> : null}
      <section className="admin-card admin-entity-page__directory" aria-label={`${labels.plural} directory`}>
        <form className="admin-entity-page__filters" role="search" aria-label={`${labels.plural} filters`} onSubmit={(event) => { event.preventDefault(); change("q", (event.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim()); }}>
          <label>
            <span>Search {plural}</span>
            <input key={query} name="q" className="admin-input" type="search" role="searchbox" aria-label={`Search ${plural}`} placeholder="Name or URL slug" defaultValue={query} />
          </label>
          <label>
            <span>Status</span>
            <select className="admin-select" aria-label="Filter by status" value={requestedStatus} onChange={(event) => change("status", event.target.value)}>
              {STATUS_OPTIONS.filter((option) => kind === "organizer" || option.value !== "suspended").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        </form>
        {isLoading ? <p className="admin-entity-page__state" role="status">Loading {plural}…</p> : null}
        {!isLoading && !error && list.length === 0 ? (
          <div className="admin-entity-page__state">
            {filtered ? (
              <>
                <h2>No {plural} match these filters</h2>
                <p>{query ? `Nothing found for “${query}”` : "Nothing in this status"}. Clear filters to see every listing.</p>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={clearFilters}>Clear filters</button>
              </>
            ) : (
              <>
                <h2>No {plural} yet</h2>
                <p>Use Create {labels.singular.toLowerCase()} to add the first listing.</p>
              </>
            )}
          </div>
        ) : null}
        {list.length > 0 ? (
          <table className="admin-entity-page__table">
            <caption className="admin-visually-hidden">{labels.plural}</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">City</th>
                <th scope="col">Events</th>
                <th scope="col">Quality</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className={`admin-entity-page__row admin-entity-page__row--${row.status}`}>
                  <th scope="row" className="admin-entity-page__cell-name">
                    <Link className="admin-entity-page__name" to={`${basePath}/${row.id}`}>{row.name}</Link>
                    <span className="admin-entity-page__slug">{row.slug ? `/${row.slug}` : "No public URL"}</span>
                  </th>
                  <td className="admin-entity-page__cell-city">{row.city ?? <span className="admin-entity-page__none">No city</span>}</td>
                  <td className="admin-entity-page__cell-events">
                    {row.linked_events.length}
                    <span className="admin-entity-page__unit"> {row.linked_events.length === 1 ? "event" : "events"}</span>
                  </td>
                  <td className="admin-entity-page__cell-quality">
                    {row.quality_issues.length > 0
                      ? <ul className="admin-entity-page__flags" aria-label="Quality issues">{row.quality_issues.map((issue) => <li key={issue}>{qualityIssueLabel(issue)}</li>)}</ul>
                      : <span className="admin-entity-page__none">Complete</span>}
                  </td>
                  <td className="admin-entity-page__cell-status">
                    <span className={`admin-entity-page__status admin-entity-page__status--${row.status}`}>{row.status.replace(/_/g, " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
