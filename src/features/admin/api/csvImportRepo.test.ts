import { beforeEach, describe, expect, it, vi } from "vitest";
import { importCsvRows, resolveVenueIdByName } from "./csvImportRepo";
import type { AdminEventPayload } from "../../events/api/eventsRepo";
/** Records the payload each events-insert receives; returns whatever the
 *  test queued via mockEventResult (one entry per row, in order). */
const mockEventInsert = vi.fn();
const mockEventResult = vi.fn();
const mockBatchInsert = vi.fn();
const mockSearchVenues = vi.fn();
const mockReplaceTerms = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        if (table !== "events") return mockBatchInsert(payload);
        mockEventInsert(payload);
        const result = mockEventResult();
        return { select: () => ({ single: () => result }) };
      },
    }),
  },
}));

vi.mock("./venuesRepo", () => ({
  searchVenues: (...args: unknown[]) => mockSearchVenues(...args),
}));

vi.mock("./taxonomyRepo", () => ({
  replaceEventTaxonomyTerms: (...args: unknown[]) => mockReplaceTerms(...args),
}));

function payload(overrides: Partial<AdminEventPayload> = {}): AdminEventPayload {
  return {
    title: "Salsa Social",
    description: null,
    event_type: "social",
    city: "boston",
    event_date: "2026-09-16T00:00:00Z",
    event_time: "20:00",
    location: null,
    address: null,
    price_type: null,
    price_amount: null,
    rsvp_link: null,
    host: null,
    image_url: null,
    recurrence: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    taxonomy_term_ids: [],
    venue_id: null,
    ...overrides,
  };
}

const IMPORTER = { id: "mod-1", email: "mod@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mockBatchInsert.mockResolvedValue({ error: null });
  mockReplaceTerms.mockResolvedValue(undefined);
});

describe("resolveVenueIdByName", () => {
  it("returns null for a blank name without querying", async () => {
    expect(await resolveVenueIdByName("  ")).toBeNull();
    expect(mockSearchVenues).not.toHaveBeenCalled();
  });

  it("links only on an exact case-insensitive name match", async () => {
    mockSearchVenues.mockResolvedValue([
      { id: "venue-1", name: "The Dance Loft" },
      { id: "venue-2", name: "The Dance Loft Annex" },
    ]);
    expect(await resolveVenueIdByName("the dance loft")).toBe("venue-1");
  });

  it("returns null when only a fuzzy near-match exists — never guesses", async () => {
    mockSearchVenues.mockResolvedValue([{ id: "venue-2", name: "The Dance Loft Annex" }]);
    expect(await resolveVenueIdByName("The Dance Loft")).toBeNull();
  });

  it("returns null when the venue search itself fails", async () => {
    mockSearchVenues.mockRejectedValue(new Error("network"));
    expect(await resolveVenueIdByName("Anything")).toBeNull();
  });
});

describe("importCsvRows", () => {
  it("stamps status approved, source_type imported, and the importing moderator", async () => {
    mockEventResult.mockReturnValue(Promise.resolve({ data: { id: "new-1" }, error: null }));
    await importCsvRows([{ rowNumber: 2, payload: payload() }], IMPORTER, "batch.csv", 1, 0);

    const inserted = mockEventInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.status).toBe("approved");
    expect(inserted.source_type).toBe("imported");
    expect(inserted.submitter_id).toBe("mod-1");
    expect(inserted.submitter_email).toBe("mod@example.com");
    expect(inserted.submitter_name).toBe("Salsa Segura");
  });

  it("does not send taxonomy_term_ids as an events column", async () => {
    mockEventResult.mockReturnValue(Promise.resolve({ data: { id: "new-1" }, error: null }));
    await importCsvRows(
      [{ rowNumber: 2, payload: payload({ taxonomy_term_ids: ["t1"] }) }],
      IMPORTER,
      "batch.csv",
      1,
      0
    );
    expect(mockEventInsert.mock.calls[0][0]).not.toHaveProperty("taxonomy_term_ids");
    expect(mockReplaceTerms).toHaveBeenCalledWith("new-1", ["t1"]);
  });

  it("skips the taxonomy call entirely when a row has no terms", async () => {
    mockEventResult.mockReturnValue(Promise.resolve({ data: { id: "new-1" }, error: null }));
    await importCsvRows([{ rowNumber: 2, payload: payload() }], IMPORTER, "batch.csv", 1, 0);
    expect(mockReplaceTerms).not.toHaveBeenCalled();
  });

  it("isolates a failed row so the rest of the batch still imports", async () => {
    mockEventResult
      .mockReturnValueOnce(Promise.resolve({ data: { id: "new-1" }, error: null }))
      .mockReturnValueOnce(Promise.resolve({ data: null, error: { message: "constraint violation" } }))
      .mockReturnValueOnce(Promise.resolve({ data: { id: "new-3" }, error: null }));

    const summary = await importCsvRows(
      [
        { rowNumber: 2, payload: payload({ title: "A" }) },
        { rowNumber: 3, payload: payload({ title: "B" }) },
        { rowNumber: 4, payload: payload({ title: "C" }) },
      ],
      IMPORTER,
      "batch.csv",
      3,
      0
    );

    expect(summary.createdCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    const failed = summary.rows.find((r) => r.outcome === "failed");
    expect(failed).toMatchObject({ rowNumber: 3, title: "B", error: "constraint violation" });
  });

  it("still reports a row as created when only its taxonomy linking fails", async () => {
    mockEventResult.mockReturnValue(Promise.resolve({ data: { id: "new-1" }, error: null }));
    mockReplaceTerms.mockRejectedValue(new Error("rpc down"));
    const summary = await importCsvRows(
      [{ rowNumber: 2, payload: payload({ taxonomy_term_ids: ["t1"] }) }],
      IMPORTER,
      "batch.csv",
      1,
      0
    );
    expect(summary.createdCount).toBe(1);
    expect(summary.failedCount).toBe(0);
  });

  it("writes an audit batch row with the real filename and counts", async () => {
    mockEventResult
      .mockReturnValueOnce(Promise.resolve({ data: { id: "new-1" }, error: null }))
      .mockReturnValueOnce(Promise.resolve({ data: null, error: { message: "bad" } }));

    await importCsvRows(
      [
        { rowNumber: 2, payload: payload({ title: "A" }) },
        { rowNumber: 3, payload: payload({ title: "B" }) },
      ],
      IMPORTER,
      "september-events.csv",
      5,
      3
    );

    expect(mockBatchInsert).toHaveBeenCalledWith({
      imported_by: "mod-1",
      filename: "september-events.csv",
      total_rows: 5,
      created_count: 1,
      duplicate_skipped_count: 3,
      failed_count: 1,
    });
  });

  it("reports totals against the whole file, not just the imported subset", async () => {
    mockEventResult.mockReturnValue(Promise.resolve({ data: { id: "new-1" }, error: null }));
    const summary = await importCsvRows([{ rowNumber: 2, payload: payload() }], IMPORTER, "b.csv", 10, 4);
    expect(summary.totalRows).toBe(10);
  });
});
