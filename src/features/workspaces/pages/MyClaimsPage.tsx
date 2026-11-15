import { Link } from "react-router-dom";
import { useClaimInbox } from "../hooks/useClaimInbox";
import { CLAIM_RELATIONSHIP_LABELS, MANAGED_KIND_LABELS, publicEntityPath } from "../model";
import "../../../components/ui/Button.css";
import "./MyClaimsPage.css";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
export default function MyClaimsPage() {
  const { items, isLoading, isError, refetch } = useClaimInbox();
  return <main className="claim-inbox">
    <Link to="/account">Back to Account</Link>
    <h1>Listing claims</h1>
    <p>Claims you've made to manage a school, venue, artist or DJ listing.</p>
    {isLoading ? <p role="status">Loading your claims…</p> : isError ?
      <div role="alert"><p>We couldn't load your claims.</p><button type="button" className="ui-button ui-button--secondary" onClick={refetch}>Try again</button></div> :
      items.length === 0 ? <div><p>You haven't claimed any listings yet.</p><Link className="ui-button ui-button--secondary" to="/discover">Browse listings</Link></div> :
      (["open", "decided"] as const).map((section) => {
        const entries = items.filter((item) => item.section === section);
        return entries.length > 0 && <section key={section} aria-labelledby={`claims-${section}`}>
          <h2 id={`claims-${section}`}>{section === "open" ? "Waiting for review" : "Decided"}</h2>
          <ul className="claim-inbox__list">{entries.map(({ claim, stateLabel, summary, note, action }) =>
            <li key={claim.id} className="claim-inbox__item">
              <h3><Link to={publicEntityPath(claim.kind, claim.slug)}>{claim.name}</Link></h3>
              <p className="claim-inbox__meta">{MANAGED_KIND_LABELS[claim.kind]} · {CLAIM_RELATIONSHIP_LABELS[claim.relationship]} · Submitted <time dateTime={claim.created_at}>{dateFormat.format(new Date(claim.created_at))}</time></p>
              <p className="claim-inbox__state">{stateLabel}</p><p>{summary}</p>
              {note && <p className="claim-inbox__note"><strong>Reviewer's note:</strong>{"\n"}{note}</p>}
              {action && <Link className={`ui-button ui-button--${action.kind === "open_workspace" ? "primary" : "secondary"}`} to={action.to}>{action.label}</Link>}
            </li>)}</ul>
        </section>;
      })}
  </main>;
}
