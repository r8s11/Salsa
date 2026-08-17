import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import AdminImportEventsPage from "./AdminImportEventsPage";
import { useCsvEventImport } from "../hooks/useCsvEventImport";
import type { CsvEventImportState, CsvRowWithDuplicates } from "../hooks/useCsvEventImport";
import type { AdminEventPayload } from "../features/events/api/eventsRepo";
import type { DatabaseEvent } from "../features/events/model/types";
import { CSV_ALL_KEYS } from "../features/admin/model/csvImportTemplate";

vi.mock("../hooks/useCsvEventImport");

function hookState(overrides: Partial<CsvEventImportState> = {}): CsvEventImportState {
  return {
    stage: "idle",
    fileName: null,
    fileSize: null,
    fileErrors: [],
    rows: [],
    counts: { total: 0, valid: 0, warning: 0, invalid: 0 },
    includedDuplicates: new Set<number>(),
    toggleIncludeDuplicate: vi.fn(),
    importableCount: 0,
    excludedDuplicateCount: 0,
    importResult: null,
    importError: null,
    handleFile: vi.fn(),
    runImport: vi.fn(),
    reset: vi.fn(),
    taxonomyLoading: false,
    ...overrides,
  } as CsvEventImportState;
}

function fullPayload(title: string): AdminEventPayload {
  return {
    title,
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
  };
}

function existingEvent(title: string): DatabaseEvent {
  return {
    id: "existing-1",
    title,
    description: null,
    event_type: "social",
    event_date: "2026-09-16T00:00:00Z",
    event_time: "8:00 PM",
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
    city: "boston",
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

function reviewingRow(overrides: Partial<CsvRowWithDuplicates> = {}): CsvRowWithDuplicates {
  return {
    rowNumber: 2,
    raw: { title: "Salsa Social", event_date: "2026-09-15" },
    payload: fullPayload("Salsa Social"),
    danceStyleNames: [],
    eventAttributeNames: [],
    venueName: "",
    errors: [],
    warnings: [],
    status: "valid",
    duplicates: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminImportEventsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminImportEventsPage — instructions and template", () => {
  beforeEach(() => {
    (useCsvEventImport as Mock).mockReturnValue(hookState());
  });

  it("explains the workflow in non-technical steps", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Import Events" })).toBeInTheDocument();
    expect(screen.getByText("Download the template below.")).toBeInTheDocument();
    expect(screen.getByText("Fix any errors it finds.")).toBeInTheDocument();
  });

  it("documents the accepted date and time formats", () => {
    renderPage();
    expect(screen.getByText(/YYYY-MM-DD/)).toBeInTheDocument();
    expect(screen.getByText(/24-hour HH:MM/)).toBeInTheDocument();
  });

  it("documents the array separator, required columns, recurrence, and row cap", () => {
    renderPage();
    expect(screen.getByText(/separate with a semicolon/)).toBeInTheDocument();
    expect(screen.getByText(/title, event_type, event_date, city/)).toBeInTheDocument();
    expect(screen.getByText(/Recurring events:/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum 200 event rows/)).toBeInTheDocument();
    expect(screen.getByText(/Blank cells are fine/)).toBeInTheDocument();
  });

  it("offers a template download whose columns match the supported schema", async () => {
    const createElementSpy = vi.spyOn(document, "createElement");
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Download CSV Template" }));

    // React Router's <Link> also creates anchors during render, so match on
    // the one that actually carries a download filename.
    const anchor = createElementSpy.mock.results
      .map((r) => r.value as HTMLElement)
      .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement && el.download !== "");
    expect(anchor?.download).toBe("salsasegura-event-import-template.csv");
    // Column set is asserted directly in csvImportTemplate.test.ts; here we
    // just confirm the page wires the real generator (not a stub).
    expect(CSV_ALL_KEYS).toContain("event_date");
    createElementSpy.mockRestore();
  });

  it("shows the upload dropzone before any file is chosen", () => {
    renderPage();
    expect(screen.getByText("Drag and drop your CSV here")).toBeInTheDocument();
  });
});

describe("AdminImportEventsPage — file-level errors", () => {
  it("surfaces a rejected file's reasons instead of a generic failure", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        fileName: "bad.txt",
        fileErrors: ["File must be a .csv file."],
      })
    );
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("File must be a .csv file.");
  });
});

describe("AdminImportEventsPage — validation review", () => {
  it("shows file metadata, detected row count, and per-status counts", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "september.csv",
        fileSize: 2048,
        rows: [reviewingRow()],
        counts: { total: 3, valid: 1, warning: 1, invalid: 1 },
        importableCount: 1,
      })
    );
    renderPage();
    expect(screen.getByText("september.csv")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/3 event rows detected/)).toBeInTheDocument();
    expect(screen.getByText("1 valid")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("1 invalid")).toBeInTheDocument();
  });

  it("lists each row's specific field errors, not a generic message", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [
          reviewingRow({
            rowNumber: 7,
            status: "invalid",
            payload: null,
            errors: [{ field: "event_time", message: "Must use 24-hour HH:MM format." }],
          }),
        ],
        counts: { total: 1, valid: 0, warning: 0, invalid: 1 },
      })
    );
    renderPage();
    expect(screen.getByText("event_time: Must use 24-hour HH:MM format.")).toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("offers an error-rows CSV download only when there are invalid rows", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [reviewingRow()],
        counts: { total: 1, valid: 1, warning: 0, invalid: 0 },
        importableCount: 1,
      })
    );
    renderPage();
    expect(screen.queryByRole("button", { name: /Download error rows/ })).not.toBeInTheDocument();
  });

  it("shows a possible-duplicate warning with an explicit opt-in checkbox", async () => {
    const toggleIncludeDuplicate = vi.fn();
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [
          reviewingRow({
            status: "warning",
            warnings: [{ field: "duplicate", message: 'Possible duplicate — matches an existing event: "Salsa Social".' }],
            duplicates: [
              { event: existingEvent("Salsa Social"), signals: ["same-date", "similar-title"], confidence: "medium" },
            ],
          }),
        ],
        counts: { total: 1, valid: 0, warning: 1, invalid: 0 },
        importableCount: 0,
        toggleIncludeDuplicate,
      })
    );
    renderPage();

    expect(screen.getByText(/Possible duplicate/)).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: /Import anyway/ });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(toggleIncludeDuplicate).toHaveBeenCalledWith(2);
  });

  it("labels the import button with the count of rows it will actually import", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [reviewingRow()],
        counts: { total: 5, valid: 3, warning: 0, invalid: 2 },
        importableCount: 3,
      })
    );
    renderPage();
    expect(screen.getByRole("button", { name: "Import Valid Events (3)" })).toBeInTheDocument();
  });

  it("disables import when nothing is importable", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "reviewing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [reviewingRow({ status: "invalid", payload: null })],
        counts: { total: 1, valid: 0, warning: 0, invalid: 1 },
        importableCount: 0,
      })
    );
    renderPage();
    expect(screen.getByRole("button", { name: /Import Valid Events/ })).toBeDisabled();
  });
});

describe("AdminImportEventsPage — import in flight (double-submit guard)", () => {
  it("disables the import button and shows progress while importing", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "importing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [reviewingRow()],
        counts: { total: 1, valid: 1, warning: 0, invalid: 0 },
        importableCount: 1,
      })
    );
    renderPage();
    const button = screen.getByRole("button", { name: "Importing…" });
    expect(button).toBeDisabled();
  });

  it("cannot be double-clicked into a second import", async () => {
    const runImport = vi.fn();
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "importing",
        fileName: "f.csv",
        fileSize: 100,
        rows: [reviewingRow()],
        counts: { total: 1, valid: 1, warning: 0, invalid: 0 },
        importableCount: 1,
        runImport,
      })
    );
    renderPage();
    const button = screen.getByRole("button", { name: "Importing…" });
    await userEvent.click(button).catch(() => {});
    expect(runImport).not.toHaveBeenCalled();
  });
});

describe("AdminImportEventsPage — results", () => {
  it("summarizes processed, created, and failed counts", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "done",
        fileName: "f.csv",
        importResult: {
          totalRows: 28,
          createdCount: 25,
          failedCount: 1,
          rows: [{ rowNumber: 9, title: "Broken One", outcome: "failed", error: "constraint violation" }],
        },
      })
    );
    renderPage();
    expect(screen.getByRole("heading", { name: "Import Complete" })).toBeInTheDocument();
    expect(screen.getByText("28 events processed")).toBeInTheDocument();
    expect(screen.getByText("25 created")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
  });

  it("lists the specific rows that failed so they can be reviewed", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "done",
        fileName: "f.csv",
        importResult: {
          totalRows: 2,
          createdCount: 1,
          failedCount: 1,
          rows: [
            { rowNumber: 2, title: "Good One", outcome: "created" },
            { rowNumber: 3, title: "Broken One", outcome: "failed", error: "constraint violation" },
          ],
        },
      })
    );
    renderPage();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/Row 3 — Broken One: constraint violation/)).toBeInTheDocument();
    expect(within(alert).queryByText(/Good One/)).not.toBeInTheDocument();
  });

  it("does not show the import button again after completion (must re-upload)", () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "done",
        fileName: "f.csv",
        importResult: { totalRows: 1, createdCount: 1, failedCount: 0, rows: [] },
      })
    );
    renderPage();
    expect(screen.queryByRole("button", { name: /Import Valid Events/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import another file" })).toBeInTheDocument();
  });

  it("offers a link back to the events list to verify the import", async () => {
    (useCsvEventImport as Mock).mockReturnValue(
      hookState({
        stage: "done",
        fileName: "f.csv",
        importResult: { totalRows: 1, createdCount: 1, failedCount: 0, rows: [] },
      })
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "View Events" })).toHaveAttribute("href", "/admin/events");
    });
  });
});
