import { describe, expect, it } from "vitest";
import {
  CSV_ALL_KEYS,
  CSV_REQUIRED_KEYS,
  buildCsvFromRows,
  buildCsvTemplate,
  csvSafeCell,
} from "./csvImportTemplate";

describe("csvSafeCell", () => {
  it("leaves a plain value untouched", () => {
    expect(csvSafeCell("Salsa Night")).toBe("Salsa Night");
  });

  it("quotes and escapes a value containing a comma", () => {
    expect(csvSafeCell("Boston, MA")).toBe('"Boston, MA"');
  });

  it("doubles embedded quotes", () => {
    expect(csvSafeCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("neutralizes a leading formula character so spreadsheets don't execute it", () => {
    // CSV injection: =cmd|... in Excel/Sheets would otherwise evaluate.
    expect(csvSafeCell("=1+1")).toBe("'=1+1");
    expect(csvSafeCell("+44 7700")).toBe("'+44 7700");
    expect(csvSafeCell("-1")).toBe("'-1");
    expect(csvSafeCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("buildCsvTemplate", () => {
  it("emits every schema column as the header row", () => {
    const [header] = buildCsvTemplate().split("\n");
    expect(header).toBe(CSV_ALL_KEYS.join(","));
  });

  it("includes exactly one example row below the header", () => {
    const lines = buildCsvTemplate().trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("populates every required column in the example row", () => {
    const [header, example] = buildCsvTemplate().trim().split("\n");
    const keys = header.split(",");
    const values = example.split(",");
    for (const required of CSV_REQUIRED_KEYS) {
      expect(values[keys.indexOf(required)]).not.toBe("");
    }
  });
});

describe("buildCsvFromRows", () => {
  it("round-trips headers and rows with escaping applied", () => {
    const csv = buildCsvFromRows(["title", "_errors"], [["A, B", 'said "no"']]);
    expect(csv).toBe('title,_errors\n"A, B","said ""no"""\n');
  });
});
