import { describe, expect, it } from "vitest";
import { acceptKeptValue, prefillFromRecord, undoPrefill } from "./entityPrefill";

type Draft = { location: string; address: string };
type Field = keyof Draft;

const fromRecord = (draft: Draft) =>
  prefillFromRecord<Draft, Field>(draft, "Canonical Club", [
    { field: "location", label: "Venue name", value: "Canonical Club", follows: true },
    { field: "address", label: "Address", value: "1 Main" },
  ]);

describe("prefillFromRecord", () => {
  it("fills only empty fields and reports each one with what it replaced", () => {
    const { draft, prefill } = fromRecord({ location: "canonical", address: "" });
    expect(draft).toEqual({ location: "Canonical Club", address: "1 Main" });
    expect(prefill.filled).toEqual([
      { field: "location", label: "Venue name", previous: "canonical", next: "Canonical Club" },
      { field: "address", label: "Address", previous: "", next: "1 Main" },
    ]);
    expect(prefill.kept).toEqual([]);
  });

  it("keeps a typed value that differs from the record and says so", () => {
    const { draft, prefill } = fromRecord({ location: "", address: "3 Side St" });
    expect(draft.address).toBe("3 Side St");
    expect(prefill.kept).toEqual([
      { field: "address", label: "Address", previous: "3 Side St", next: "1 Main" },
    ]);
  });

  it("treats spacing and case differences as the same value, and skips blank record values", () => {
    const { prefill } = prefillFromRecord<Draft, Field>(
      { location: "canonical  club", address: "" },
      "Canonical Club",
      [
        { field: "location", label: "Venue name", value: "Canonical Club", follows: true },
        { field: "address", label: "Address", value: "   " },
      ]
    );
    expect(prefill.filled).toEqual([]);
    expect(prefill.kept).toEqual([]);
  });
});

describe("undoPrefill", () => {
  it("restores filled fields that are untouched and leaves later edits alone", () => {
    const { draft, prefill } = fromRecord({ location: "canonical", address: "" });
    const edited = { ...draft, address: "1 Main, Suite 2" };
    expect(undoPrefill(edited, prefill)).toEqual({ location: "canonical", address: "1 Main, Suite 2" });
  });
});

describe("acceptKeptValue", () => {
  it("takes the record's value on request, and undo then reverts it too", () => {
    const first = fromRecord({ location: "", address: "3 Side St" });
    const { draft, prefill } = acceptKeptValue(first.draft, first.prefill, "address");
    expect(draft.address).toBe("1 Main");
    expect(prefill.kept).toEqual([]);
    expect(undoPrefill(draft, prefill)).toEqual({ location: "", address: "3 Side St" });
  });
});
