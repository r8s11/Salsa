import { useState, type FormEvent } from "react";
import { useMetros } from "../../metros/hooks/useMetros";
import type { DirectorySearch } from "../hooks/useEntityDirectory";
import { ENTITY_LABELS, PUBLIC_ENTITY_KINDS, type PublicEntityKind } from "../model";

type Props = {
  kind?: PublicEntityKind;
  onSearch: (search: DirectorySearch) => void;
};

export function EntityDirectorySearch({ kind, onSearch }: Props) {
  const [draftQuery, setDraftQuery] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftKind, setDraftKind] = useState<PublicEntityKind | "">(kind ?? "");
  const { metros } = useMetros();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({ query: draftQuery.trim(), city: draftCity, kind: draftKind || undefined });
  }

  return (
    <form className={kind ? "entity-directory__search" : "entity-directory__search entity-directory__search--typed"} role="search" onSubmit={submit}>
      <label>
        <span>Search</span>
        <input
          type="search"
          aria-label="Search"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="Name or description"
        />
      </label>
      {!kind && (
        <label>
          <span>Type</span>
          <select aria-label="Type" value={draftKind} onChange={(event) => setDraftKind(event.target.value as PublicEntityKind | "")}>
            <option value="">All kinds</option>
            {PUBLIC_ENTITY_KINDS.map((entityKind) => <option key={entityKind} value={entityKind}>{ENTITY_LABELS[entityKind]}</option>)}
          </select>
        </label>
      )}
      <label>
        <span>City</span>
        <select aria-label="City" value={draftCity} onChange={(event) => setDraftCity(event.target.value)}>
          <option value="">All cities</option>
          {metros.map((metro) => <option key={metro.slug} value={metro.slug}>{metro.name}</option>)}
        </select>
      </label>
      <button type="submit" className="ui-button ui-button--primary">Search</button>
    </form>
  );
}
