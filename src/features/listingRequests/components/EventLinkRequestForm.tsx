import { useId, useState, type FormEvent } from "react";
import { useDebouncedSearch } from "../../../shared/hooks/useDebouncedSearch";
import WorkspaceField from "../../workspaces/components/WorkspaceField";
import { errorMessage } from "../../workspaces/hooks/useEntityWorkspace";
import { useEventLinkCandidates, useSubmitEventLinkRequest } from "../hooks/useListingRequests";
import type { EventLinkCandidate, EventLinkKind } from "../model";

type EventLinkRequestFormProps = { kind: EventLinkKind; entityId: string; entityName: string };

function eventSummary(event: EventLinkCandidate): string {
  const date = new Date(event.event_date).toLocaleDateString(undefined, { dateStyle: "medium" });
  return [event.title, date, event.location].filter(Boolean).join(" · ");
}

/** An Artist/DJ owner or manager asks for an approved event to appear on the profile. */
export default function EventLinkRequestForm({ kind, entityId, entityName }: EventLinkRequestFormProps) {
  const titleId = useId();
  const submit = useSubmitEventLinkRequest();
  const [query, setQuery] = useState("");
  const { input: search, handleInput: setSearch } = useDebouncedSearch(query, setQuery);
  const [selected, setSelected] = useState<EventLinkCandidate | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const candidates = useEventLinkCandidates(kind, entityId, query);
  const searching = query.trim().length >= 2;
  // The chosen event stays listed even when a later search no longer matches it.
  const found = candidates.data ?? [];
  const options = selected && !found.some((event) => event.id === selected.id) ? [selected, ...found] : found;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || submit.isPending) return;
    setSent(false);
    try {
      await submit.mutateAsync({ kind, entityId, eventId: selected.id, note: note.trim() });
      setSelected(null);
      setNote("");
      setQuery("");
      setSent(true);
    } catch {
      // The mutation holds the server's message; the selection and note stay as typed.
    }
  };

  return (
    <section className="ws-add" aria-labelledby={titleId}>
      <h2 id={titleId} className="ws-add__title">
        Ask for an event to be added to {entityName}
      </h2>
      <form className="ws-form" aria-labelledby={titleId} noValidate onSubmit={onSubmit}>
        <p className="ws-note">Salsa Segura checks every request. The event's organizer keeps control of the event.</p>
        <div className="ws-form__grid">
          <WorkspaceField label="Find an event" hint="Search approved events by title." wide>
            {(control) => (
              <input
                {...control}
                className="admin-input"
                type="search"
                autoComplete="off"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSent(false);
                  submit.reset();
                }}
              />
            )}
          </WorkspaceField>

          {(searching || selected) && (
            <fieldset className="ws-field ws-field--wide lrq-events">
              <legend>Matching events</legend>
              {searching && candidates.isPending ? (
                <p className="ws-note" role="status">
                  Searching events…
                </p>
              ) : searching && candidates.isError ? (
                <p className="ws-form__alert" role="alert">
                  {errorMessage(candidates.error)}
                </p>
              ) : options.length === 0 ? (
                <p className="ws-note" role="status">
                  No approved event matches that title, or it is already on this profile.
                </p>
              ) : (
                options.map((event) => (
                  <label key={event.id} className="lrq-events__option">
                    <input
                      type="radio"
                      name={`${titleId}-event`}
                      checked={selected?.id === event.id}
                      onChange={() => {
                        setSelected(event);
                        submit.reset();
                      }}
                    />
                    <span>{eventSummary(event)}</span>
                  </label>
                ))
              )}
            </fieldset>
          )}

          <WorkspaceField label="Note for the reviewer" hint="Optional. Say how you are part of this event." wide>
            {(control) => (
              <textarea {...control} className="admin-textarea" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
            )}
          </WorkspaceField>
        </div>

        {submit.isError && (
          <p className="ws-form__alert" role="alert">
            {errorMessage(submit.error)}
          </p>
        )}
        <div className="ws-form__actions">
          <button type="submit" className="desk__action desk__action--primary" disabled={!selected || submit.isPending}>
            {submit.isPending ? "Sending…" : "Send request"}
          </button>
          <p className="ws-status" role="status">
            {sent ? "Request sent. It is waiting for review." : ""}
          </p>
        </div>
      </form>
    </section>
  );
}
