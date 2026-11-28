import { LayoutGrid } from "lucide-react";
import { ENTITY_GLYPHS } from "../entityGlyphs";
import { useState, type FormEvent } from "react";
import { useMetros } from "../../metros/hooks/useMetros";
import { NYC_SUBLOCATIONS } from "../../metros/model/sublocation";
import type { DirectorySearch } from "../hooks/useEntityDirectory";
import { ENTITY_LABELS, PUBLIC_ENTITY_KINDS, type PublicEntityKind } from "../model";

type Props = {
  kind?: PublicEntityKind;
  /** Restores the fields when the form remounts after a search changed outside it. */
  initial?: DirectorySearch;
  onSearch: (search: DirectorySearch) => void;
};

export function EntityDirectorySearch({ kind, initial, onSearch }: Props) {
  const [draftQuery, setDraftQuery] = useState(initial?.query ?? "");
  const [draftCity, setDraftCity] = useState(initial?.city ?? "");
  const [draftBorough, setDraftBorough] = useState(initial?.borough ?? "");
  const [draftKind, setDraftKind] = useState<PublicEntityKind | "">(kind ?? initial?.kind ?? "");
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
        <fieldset className="ss-kinds">
          <legend className="ss-sr">Type</legend>
          {[["", "All kinds"], ...PUBLIC_ENTITY_KINDS.map((entityKind) => [entityKind, ENTITY_LABELS[entityKind]])].map(([value, label]) => {
            const Glyph = value ? ENTITY_GLYPHS[value as PublicEntityKind] : LayoutGrid;
            return (
              <label key={value} className="ss-chip" title={label}>
                <input type="radio" name="entity-kind" value={value} checked={draftKind === value} onChange={() => setDraftKind(value as PublicEntityKind | "")} />
                <Glyph size={16} aria-hidden="true" />
                <span>{label}</span>
              </label>
            );
          })}
        </fieldset>
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
