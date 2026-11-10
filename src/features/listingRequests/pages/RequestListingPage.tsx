import { useId, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { entityHref } from "../../entities/entitiesRepo";
import { useDebouncedSearch } from "../../../shared/hooks/useDebouncedSearch";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { errorMessage } from "../../workspaces/hooks/useEntityWorkspace";
import { MANAGED_KINDS, MANAGED_KIND_LABELS, type ManagedKind } from "../../workspaces/model";
import ListingRequestStatusList from "../components/ListingRequestStatusList";
import { useExistingListingSearch } from "../hooks/useExistingListingSearch";
import { useSubmitMissingListing } from "../hooks/useListingRequests";
import type { ListingRequest } from "../model";
import "./RequestListingPage.css";

const WEBSITE_ERROR = "Website must be a full link starting with https://";

function isHttpsLink(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function kindFromQuery(value: string | null): ManagedKind {
  return MANAGED_KINDS.find((kind) => kind === value) ?? "venue";
}

const isMissingListing = (request: ListingRequest) => request.request_type === "missing_listing";

/** Ask for a School, Venue, Artist or DJ that is not in the directory yet. */
export default function RequestListingPage() {
  const [params] = useSearchParams();
  // A new key remounts the form, clearing every field after a request is sent.
  const [sentCount, setSentCount] = useState(0);

  useDocumentMeta({
    title: "Request a listing",
    description: "Ask Salsa Segura to add a school, venue, artist or DJ that is missing from the directory.",
    robots: "noindex, nofollow",
  });

  return (
    <section className="lrq-page" aria-labelledby="lrq-page-title">
      <header className="lrq-page__intro">
        <h1 id="lrq-page-title">Request a listing</h1>
        <p>
          Check that it is not already in the directory. Requests are reviewed by Salsa Segura before anything is
          published.
        </p>
      </header>

      <RequestForm key={sentCount} initialKind={kindFromQuery(params.get("kind"))} onSent={() => setSentCount((count) => count + 1)} />

      <p className="lrq-page__sent" role="status">
        {sentCount > 0 ? "Request sent. We will review it; you can follow it below." : ""}
      </p>

      <ListingRequestStatusList
        heading="Your listing requests"
        emptyText="You have not asked for a listing yet."
        filter={isMissingListing}
      />
    </section>
  );
}

function RequestForm({ initialKind, onSent }: { initialKind: ManagedKind; onSent: () => void }) {
  const ids = useId();
  const submit = useSubmitMissingListing();
  const [kind, setKind] = useState<ManagedKind>(initialKind);
  const [searchTerm, setSearchTerm] = useState("");
  const { input: name, handleInput: setName } = useDebouncedSearch(searchTerm, setSearchTerm);
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [details, setDetails] = useState("");
  const [checked, setChecked] = useState(false);
  const [websiteError, setWebsiteError] = useState(false);

  const matches = useExistingListingSearch(kind, searchTerm);
  const searching = searchTerm.trim().length >= 2;
  const kindLabel = MANAGED_KIND_LABELS[kind];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submit.isPending) return;
    const link = website.trim();
    if (link !== "" && !isHttpsLink(link)) {
      setWebsiteError(true);
      event.currentTarget.querySelector<HTMLElement>(`[id="${ids}-website"]`)?.focus();
      return;
    }
    try {
      await submit.mutateAsync({
        kind,
        name: name.trim(),
        city: city.trim(),
        website: link,
        instagram: instagram.trim(),
        details: details.trim(),
        checkedExisting: checked,
      });
      onSent();
    } catch {
      // The mutation holds the server's message; it renders above the button and the fields keep their values.
    }
  };

  return (
    <form className="lrq-form" aria-label="Request a listing" noValidate onSubmit={onSubmit}>
      <div className="lrq-form__field">
        <label htmlFor={`${ids}-kind`}>Type of listing</label>
        <select
          id={`${ids}-kind`}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as ManagedKind);
            setChecked(false);
          }}
        >
          {MANAGED_KINDS.map((value) => (
            <option key={value} value={value}>
              {MANAGED_KIND_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="lrq-form__field">
        <label htmlFor={`${ids}-name`}>Name</label>
        <input
          id={`${ids}-name`}
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setChecked(false);
            submit.reset();
          }}
        />
      </div>

      {searching && (
        <section className="lrq-matches" aria-label="Possible matches">
          <h2 className="lrq-matches__title">Possible matches</h2>
          {matches.isPending ? (
            <p role="status">Searching the directory…</p>
          ) : matches.isError ? (
            <p role="alert">We could not search the directory. Check it yourself before sending: {errorMessage(matches.error)}</p>
          ) : matches.data.length === 0 ? (
            <p role="status">No {kindLabel} with that name is in the directory.</p>
          ) : (
            <>
              <p>
                Is it one of these? Open it and use Claim this {kind === "instructor" || kind === "dj" ? "profile" : kind}.
              </p>
              <ul>
                {matches.data.map((match) => (
                  <li key={match.id}>
                    <Link to={entityHref(match)}>
                      {match.name}
                      {match.city ? <span className="lrq-matches__city"> · {match.city}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="lrq-form__field">
        <label htmlFor={`${ids}-city`}>City</label>
        <input id={`${ids}-city`} type="text" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} />
      </div>

      <div className="lrq-form__field">
        <label htmlFor={`${ids}-website`}>Website</label>
        <input
          id={`${ids}-website`}
          type="url"
          inputMode="url"
          maxLength={500}
          placeholder="https://"
          value={website}
          aria-invalid={websiteError ? true : undefined}
          aria-describedby={websiteError ? `${ids}-website-error` : undefined}
          onChange={(event) => {
            setWebsite(event.target.value);
            setWebsiteError(false);
          }}
        />
        {websiteError && (
          <p id={`${ids}-website-error`} className="lrq-form__error">
            {WEBSITE_ERROR}
          </p>
        )}
      </div>

      <div className="lrq-form__field">
        <label htmlFor={`${ids}-instagram`}>Instagram</label>
        <input id={`${ids}-instagram`} type="text" maxLength={200} value={instagram} onChange={(event) => setInstagram(event.target.value)} />
      </div>

      <div className="lrq-form__field">
        <label htmlFor={`${ids}-details`}>Anything that helps us verify it</label>
        <textarea id={`${ids}-details`} rows={4} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />
      </div>

      <label className="lrq-form__check">
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
        <span>I searched and this listing is not here</span>
      </label>

      {submit.isError && (
        <p className="lrq-form__alert" role="alert">
          {errorMessage(submit.error)}
        </p>
      )}

      <div className="lrq-form__actions">
        <button type="submit" className="ui-button ui-button--primary" disabled={!checked || name.trim() === "" || submit.isPending}>
          {submit.isPending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
