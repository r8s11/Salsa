import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCsvEventImport } from "./useCsvEventImport";
import { importCsvRows, resolveVenueIdByName } from "../api/csvImportRepo";
import { fetchAllEvents } from "../../events/api/eventsRepo";
import type { DatabaseEvent } from "../../events/model/types";

vi.mock("../api/csvImportRepo", () => ({
  importCsvRows: vi.fn(),
  resolveVenueIdByName: vi.fn(),
}));

vi.mock("../../events/api/eventsRepo", () => ({
  fetchAllEvents: vi.fn(),
}));

const mockAuth = vi.hoisted(() => ({
  user: { id: "admin-1", email: "admin@example.com" } as { id: string; email: string } | null,
}));

vi.mock("../../../contexts/useAuth", () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));

const mockTaxonomy = vi.hoisted(() => ({
  terms: [] as { id: string; name: string }[],
  isLoading: false,
  error: null as string | null,
}));

vi.mock("./useAdminTaxonomy", () => ({
  useActiveTaxonomyTerms: () => ({
    terms: mockTaxonomy.terms,
    isLoading: mockTaxonomy.isLoading,
    error: mockTaxonomy.error,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

const ONE_ROW_CSV = "title,event_type,event_date,city\nSalsa Smoke Test,social,2026-09-30,new-york-city\n";

function csvFile(contents: string, name = "import.csv", type = "text/csv"): File {
  return new File([contents], name, { type });
}

function existingEvent(title: string, eventDate: string): DatabaseEvent {
  return {
    id: "existing-1",
    title,
    description: null,
    event_type: "social",
    event_date: eventDate,
    event_time: null,
    location: null,
    address: null,
    price_type: null,
    price_amount: null,
    rsvp_link: null,
    image_url: null,
    submitter_name: null,
    submitter_email: null,
    submitter_id: null,
    status: "approved",
    source_type: "admin",
    taxonomy_term_ids: [],
    taxonomy_terms: [],
    updated_at: "2026-08-01T00:00:00Z",
    cancellation_reason: null,
    city: "new-york-city",
    created_at: "2026-08-01T00:00:00Z",
    host: null,
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    venue_id: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.user = { id: "admin-1", email: "admin@example.com" };
  mockTaxonomy.terms = [];
  mockTaxonomy.isLoading = false;
  mockTaxonomy.error = null;
  vi.mocked(resolveVenueIdByName).mockResolvedValue(null);
  vi.mocked(fetchAllEvents).mockResolvedValue([]);
  vi.mocked(importCsvRows).mockResolvedValue({
    totalRows: 1,
    createdCount: 1,
    failedCount: 0,
    rows: [{ rowNumber: 2, title: "Salsa Smoke Test", outcome: "created" }],
  });
});

describe("useCsvEventImport — known-good pipeline", () => {
  it("takes a minimal 1-row CSV from file to reviewing with 1 importable row", async () => {
    const { result } = renderHook(() => useCsvEventImport(), { wrapper });
    await act(async () => {
      await result.current.handleFile(csvFile(ONE_ROW_CSV));
    });
    expect(result.current.stage).toBe("reviewing");
    expect(result.current.counts.total).toBe(1);
    expect(result.current.importableCount).toBe(1);
  });

  it("clicking through runImport with an importable row calls importCsvRows and finishes", async () => {
    const { result } = renderHook(() => useCsvEventImport(), { wrapper });
    await act(async () => {
      await result.current.handleFile(csvFile(ONE_ROW_CSV));
    });
    await act(async () => {
      await result.current.runImport();
    });
    expect(importCsvRows).toHaveBeenCalledTimes(1);
    expect(result.current.stage).toBe("done");
    expect(result.current.importResult?.createdCount).toBe(1);
  });
});

describe("useCsvEventImport — duplicate dead-end", () => {
  it("explains instead of silently returning when every row is an unchecked duplicate", async () => {
    vi.mocked(fetchAllEvents).mockResolvedValue([
      existingEvent("Salsa Smoke Test", "2026-09-30T00:00:00Z"),
    ]);
    const { result } = renderHook(() => useCsvEventImport(), { wrapper });
    await act(async () => {
      await result.current.handleFile(csvFile(ONE_ROW_CSV));
    });
    expect(result.current.stage).toBe("reviewing");
    expect(result.current.importableCount).toBe(0);

    await act(async () => {
      await result.current.runImport();
    });
    expect(importCsvRows).not.toHaveBeenCalled();
    expect(result.current.importError).toMatch(/duplicate/i);
  });
});

describe("useCsvEventImport — taxonomy prerequisite failure", () => {
  it("surfaces a taxonomy load failure instead of validating against empty terms", async () => {
    mockTaxonomy.error = "taxonomy RPC down";
    const { result } = renderHook(() => useCsvEventImport(), { wrapper });
    expect(result.current.taxonomyError).toMatch(/taxonomy/i);
  });
});

describe("useCsvEventImport — browser MIME variants", () => {
  it("accepts a .csv file reported as application/csv", async () => {
    const { result } = renderHook(() => useCsvEventImport(), { wrapper });
    await act(async () => {
      await result.current.handleFile(csvFile(ONE_ROW_CSV, "import.csv", "application/csv"));
    });
    expect(result.current.fileErrors).toEqual([]);
    expect(result.current.stage).toBe("reviewing");
  });
});

describe("useCsvEventImport — missing user", () => {
  it("reports instead of silently returning when there is no authenticated user", async () => {
    const { result, rerender } = renderHook(() => useCsvEventImport(), { wrapper });
    await act(async () => {
      await result.current.handleFile(csvFile(ONE_ROW_CSV));
    });
    expect(result.current.importableCount).toBe(1);
    mockAuth.user = null;
    rerender();
    await act(async () => {
      await result.current.runImport();
    });
    expect(importCsvRows).not.toHaveBeenCalled();
    expect(result.current.importError).toMatch(/sign|auth|user/i);
  });
});
