import { describe, expect, it } from "vitest";
import { reportCsv, reportFilename, parseOperations, parseReport } from "./operationalAnalytics";

describe("operational analytics consumer contract", () => {
  it("never replaces absent or malformed operational sections with zeros", () => {
    const data = parseOperations({ submissions: { pending: "broken" }, metros: null });
    expect(data.submissions).toBeNull();
    expect(data.metros).toBeNull();
    expect(data.quality).toBeNull();
    expect(data.activity).toBeNull();
  });
  it("neutralizes formula text, whitespace prefixes and cell delimiters without changing numeric signs", () => {
    const csv = reportCsv({ headers: ["Name", "Count"], rows: [["=HYPERLINK(\"bad\")", -12], [" \t+SUM(1,2)", 3], ["@command", 4], ["-formula", 5], ["Line\n\"quoted\",text", 6]], total: 5, limit: 10000, asOf: "2026-10-12T12:00:00Z", from: null, to: null, scope: "Current state", engagementAvailable: false });
    expect(csv).toContain('"\'=HYPERLINK(""bad"")",-12');
    expect(csv).toContain('"\' \t+SUM(1,2)",3');
    expect(csv).toContain("'@command,4");
    expect(csv).toContain("'-formula,5");
    expect(csv).toContain('"Line\n""quoted"",text",6');
  });
  it("rejects silent truncation without a declared limit", () => {
    expect(() => parseReport({ headers: ["Event"], rows: [["one"]], total: 2, limit: null })).toThrow();
  });
  it("identifies partial reports in filename and preserves their exact period metadata", () => {
    const report = parseReport({ headers: ["Event"], rows: [["one"]], total: 2, limit: 1, as_of: "2026-10-12T12:00:00Z", from_date: "2026-10-06T04:00:00Z", to_date: "2026-10-13T04:00:00Z", scope: "Selected interactions", engagement_available: true });
    expect(reportFilename("events", "7d", report, new Date("2026-10-12T12:00:00Z"))).toBe("salsasegura-analytics-events-7d-2026-10-12-partial.csv");
    expect(reportCsv(report)).toContain("2026-10-06 00:00:00 EDT");
    expect(reportCsv(report)).toContain("2026-10-13 00:00:00 EDT");
    expect(reportCsv(report)).toContain("1 of 2 rows; PARTIAL");
  });
  it("keeps datetime-looking untrusted entity text as text", () => {
    const report = parseReport({ headers: ["Name", "Scheduled date"], rows: [["2026-10-12T12:00:00Z", "2026-10-12T12:00:00Z"]], total: 1, limit: 10000, as_of: "2026-10-12T12:00:00Z", from_date: null, to_date: null, scope: "Current state", engagement_available: false });
    expect(reportCsv(report)).toContain("2026-10-12T12:00:00Z,2026-10-12 08:00:00 EDT");
  });
});
