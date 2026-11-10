import { useId, useState, type FormEvent } from "react";
import WorkspaceField from "../../workspaces/components/WorkspaceField";
import { errorMessage } from "../../workspaces/hooks/useEntityWorkspace";
import type { ManagedKind } from "../../workspaces/model";
import { useSubmitProfileChangeRequest } from "../hooks/useListingRequests";

type ProfileChangeRequestFormProps = { kind: ManagedKind; entityId: string };

/** An owner or manager asks Salsa Segura to change the identity fields they cannot edit themselves. */
export default function ProfileChangeRequestForm({ kind, entityId }: ProfileChangeRequestFormProps) {
  const titleId = useId();
  const submit = useSubmitProfileChangeRequest();
  const [requestedName, setRequestedName] = useState("");
  const [requestedCity, setRequestedCity] = useState("");
  const [note, setNote] = useState("");
  const [empty, setEmpty] = useState(false);
  const [sent, setSent] = useState(false);

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setEmpty(false);
    setSent(false);
    submit.reset();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submit.isPending) return;
    const input = { requestedName: requestedName.trim(), requestedCity: requestedCity.trim(), note: note.trim() };
    if (!input.requestedName && !input.requestedCity && !input.note) {
      setEmpty(true);
      return;
    }
    setSent(false);
    try {
      await submit.mutateAsync({ kind, entityId, ...input });
      setRequestedName("");
      setRequestedCity("");
      setNote("");
      setSent(true);
    } catch {
      // The mutation holds the server's message; the fields keep their values.
    }
  };

  return (
    <section className="ws-add" aria-labelledby={titleId}>
      <h2 id={titleId} className="ws-add__title">
        Ask for a change to name, city or page address
      </h2>
      <form className="ws-form" aria-labelledby={titleId} noValidate onSubmit={onSubmit}>
        <div className="ws-form__grid">
          <WorkspaceField label="New name">
            {(control) => (
              <input {...control} className="admin-input" type="text" maxLength={200} value={requestedName} onChange={(event) => edit(setRequestedName)(event.target.value)} />
            )}
          </WorkspaceField>
          <WorkspaceField label="New city">
            {(control) => (
              <input {...control} className="admin-input" type="text" maxLength={120} value={requestedCity} onChange={(event) => edit(setRequestedCity)(event.target.value)} />
            )}
          </WorkspaceField>
          <WorkspaceField label="What should change and why" hint="Use this for a new page address too." wide>
            {(control) => (
              <textarea {...control} className="admin-textarea" rows={3} maxLength={2000} value={note} onChange={(event) => edit(setNote)(event.target.value)} />
            )}
          </WorkspaceField>
        </div>

        {empty ? (
          <p className="ws-form__alert" role="alert">
            Fill in at least one field.
          </p>
        ) : (
          submit.isError && (
            <p className="ws-form__alert" role="alert">
              {errorMessage(submit.error)}
            </p>
          )
        )}
        <div className="ws-form__actions">
          <button type="submit" className="desk__action desk__action--primary" disabled={submit.isPending}>
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
