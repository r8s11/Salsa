import { Link } from "react-router-dom";
import { useMyEntityClaims } from "../../features/workspaces/hooks/useMyEntityMemberships";

export default function AccountClaimsCard() {
  const { data, isPending, isError } = useMyEntityClaims();
  if (isPending || isError || !data?.length) return null;
  const pending = data.filter((claim) => claim.status === "pending").length;
  return <article className="account-page__card account-page__capability-card">
    <div className="account-page__capability-title-row"><h3>Listing claims</h3></div>
    <p>{pending > 0 ? `${pending} waiting for review` : "Check the status of your listing claims."}</p>
    <div className="account-page__capability-actions"><Link className="account-page__capability-link account-page__capability-link--primary" to="/account/claims">Open your claims</Link></div>
  </article>;
}
