import { useState, type FormEvent } from "react";
import { useMetros } from "../../metros/hooks/useMetros";
import { NYC_SUBLOCATIONS } from "../../metros/model/sublocation";
import type { DirectorySearch } from "../hooks/useEntityDirectory";
import { ENTITY_LABELS, PUBLIC_ENTITY_KINDS, type PublicEntityKind } from "../model";

type Props = {
  kind?: PublicEntityKind;
  onSearch: (search: DirectorySearch) => void;
};

export function EntityDirectorySearch({ kind, onSearch }: Props) {
  const [draftQuery, setDraftQuery] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftBorough, setDraftBorough] = useState("");
  const [draftKind, setDraftKind] = useState<PublicEntityKind | "">(kind ?? "");
  const { metros } = useMetros();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({ query: draftQuery.trim(), city: draftCity, borough: draftKind === "school" && draftCity === "new-york-city" ? draftBorough : "", kind: draftKind || undefined });
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
        <span>Metropolitan area</span>
        <select aria-label="Metropolitan area" value={draftCity} onChange={(event) => { setDraftCity(event.target.value); setDraftBorough(""); }}>
          <option value="">All cities</option>
          {metros.map((metro) => <option key={metro.slug} value={metro.slug}>{metro.name}</option>)}
        </select>
      </label>
      {(kind === "school" || (!kind && draftKind === "school")) && draftCity === "new-york-city" && (
        <label>
          <span>NYC borough</span>
          <select aria-label="NYC borough" value={draftBorough} onChange={(event) => setDraftBorough(event.target.value)}>
            <option value="">All NYC boroughs</option>
            {NYC_SUBLOCATIONS.map((borough) => <option key={borough.slug} value={borough.slug}>{borough.name}</option>)}
          </select>
        </label>
      )}
      <button type="submit" className="ui-button ui-button--primary">Search</button>
    </form>
  );
}
