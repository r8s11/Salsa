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
  const basePath = `/admin/${kind === "series" ? "series" : kind === "organizer" ? "organizers" : `${kind}s`}`;
  const change = (key: "q" | "status", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="admin-entity-page">
      <header className="admin-entity-page__header">
        <h1>{labels.plural}</h1>
        <Link className="admin-btn admin-btn--primary" to={`${basePath}/new`}>Create {labels.singular.toLowerCase()}</Link>
      </header>
      <form className="admin-card admin-entity-page__filters" role="search" aria-label={`${labels.plural} filters`} onSubmit={(event) => { event.preventDefault(); change("q", (event.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim()); }}>
        <label className="admin-entity-page__search">
          <span>Search {labels.plural.toLowerCase()}</span>
          <input key={query} name="q" className="admin-input" type="search" role="searchbox" aria-label={`Search ${labels.plural.toLowerCase()}`} defaultValue={query} />
        </label>
        <label>
          <span>Status</span>
          <select className="admin-select" aria-label="Filter by status" value={requestedStatus} onChange={(event) => change("status", event.target.value)}>
            {STATUS_OPTIONS.filter((option) => kind === "organizer" || option.value !== "suspended").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
      </form>
      {isLoading ? <p className="admin-entity-page__state" role="status">Loading {labels.plural.toLowerCase()}…</p> : null}
      {error ? <div className="admin-banner admin-banner--error" role="alert"><p>Could not load {labels.plural.toLowerCase()}: {error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>Try again</button></div> : null}
      {!isLoading && !error && (rows?.length ?? 0) === 0 ? <div className="admin-card admin-entity-page__empty"><h2>No {labels.plural.toLowerCase()} found</h2><p>Try a different search or status filter.</p></div> : null}
      <ul className="admin-entity-page__list">
        {(rows ?? []).map((row) => (
          <li className="admin-card admin-entity-page__card" key={row.id}>
            <div className="admin-entity-page__card-heading">
              <div><Link className="admin-entity-page__name" to={`${basePath}/${row.id}`}>{row.name}</Link><p className="admin-entity-page__meta">{[row.city, row.slug ? `/${row.slug}` : null].filter(Boolean).join(" · ") || "No city or public URL"}</p></div>
              <span className={`admin-entity-page__status admin-entity-page__status--${row.status}`}>{row.status.replace(/_/g, " ")}</span>
            </div>
            <p className="admin-entity-page__events">{row.linked_events.length} linked {row.linked_events.length === 1 ? "event" : "events"}</p>
            {row.quality_issues.length > 0 ? <ul className="admin-entity-page__quality" aria-label="Quality issues">{row.quality_issues.map((issue) => <li key={issue}>{qualityIssueLabel(issue)}</li>)}</ul> : <p className="admin-entity-page__quality-clear">No quality issues</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
