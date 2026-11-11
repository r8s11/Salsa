import { useId } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../workspaces/hooks/useEntityWorkspace";
import { PUBLIC_PATH_PREFIX } from "../../workspaces/offeringForm";
import { useMyListingRequests, useWithdrawListingRequest } from "../hooks/useListingRequests";
import { requestHeadline, requestStatusWord, type ListingRequest } from "../model";
import "./ListingRequestStatusList.css";

type ListingRequestStatusListProps = {
  /** Narrows the caller's requests, e.g. to one listing or one request type. */
  filter?: (request: ListingRequest) => boolean;
  heading?: string;
  emptyText: string;
  /** Button classes for Withdraw; the workspace shell passes its own desk action style. */
  actionClassName?: string;
};

function submittedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** The signed-in person's own requests with their status; pending ones can be withdrawn. */
export default function ListingRequestStatusList({
  filter,
  heading = "Your requests",
  emptyText,
  actionClassName = "ui-button ui-button--secondary",
}: ListingRequestStatusListProps) {
  const headingId = useId();
  const query = useMyListingRequests();
  const withdraw = useWithdrawListingRequest();
  const requests = (query.data ?? []).filter(filter ?? (() => true));

  return (
    <section className="lrq-status" aria-labelledby={headingId}>
      <h2 id={headingId} className="lrq-status__heading">
        {heading}
      </h2>

      {withdraw.isError && (
        <p className="lrq-status__alert" role="alert">
          {errorMessage(withdraw.error)}
        </p>
      )}

      {query.isPending ? (
        <p className="lrq-status__note" role="status">
          Loading your requests…
        </p>
      ) : query.isError ? (
        <p className="lrq-status__alert" role="alert">
          {errorMessage(query.error)}
        </p>
      ) : requests.length === 0 ? (
        <p className="lrq-status__note">{emptyText}</p>
      ) : (
        <ul className="lrq-status__list">
          {requests.map((request) => {
            const headline = requestHeadline(request);
            const claimPath =
              request.request_type === "missing_listing" && request.status === "approved" && request.entity_kind && request.resulting_entity_slug
                ? `${PUBLIC_PATH_PREFIX[request.entity_kind]}/${request.resulting_entity_slug}`
                : null;
            return (
              <li key={request.id} className="lrq-status__row" aria-label={headline}>
                <div className="lrq-status__main">
                  <p className="lrq-status__headline">{headline}</p>
                  <p className="lrq-status__meta">
                    <span className={`lrq-status__word lrq-status__word--${request.status}`}>{requestStatusWord(request)}</span>
                    <span aria-hidden="true"> · </span>
                    Sent {submittedOn(request.created_at)}
                  </p>
                  {request.details && <p className="lrq-status__details">{request.details}</p>}
                  {request.status === "rejected" && request.review_note && (
                    <p className="lrq-status__details">Note: {request.review_note}</p>
                  )}
                  {claimPath && (
                    <p className="lrq-status__details">
                      The listing is in the directory. <Link to={claimPath}>Claim it</Link> to manage it.
                    </p>
                  )}
                </div>
                {request.status === "pending" && (
                  <button
                    type="button"
                    className={`${actionClassName} lrq-status__withdraw`}
                    aria-label={`Withdraw request: ${headline}`}
                    disabled={withdraw.isPending}
                    onClick={() => withdraw.mutate(request.id)}
                  >
                    Withdraw
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
