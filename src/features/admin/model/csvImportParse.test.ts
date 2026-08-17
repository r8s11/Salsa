import { describe, expect, it } from "vitest";
import { parseCsvFile } from "./csvImportParse";
import { CSV_ALL_KEYS, CSV_MAX_ROWS } from "./csvImportTemplate";

function csvFile(content: string, name = "events.csv", type = "text/csv"): File {
  return new File([content], name, { type });
}

const HEADER = CSV_ALL_KEYS.join(",");

function rowFor(values: Partial<Record<string, string>>): string {
  return CSV_ALL_KEYS.map((key) => values[key] ?? "").join(",");
}

describe("parseCsvFile — file-level checks", () => {
  it("rejects a non-csv extension", async () => {
    const result = await parseCsvFile(csvFile("a,b", "events.txt", "text/plain"));
    expect(result.ok).toBe(false);
    expect(result.fileErrors).toContain("File must be a .csv file.");
  });

  it("rejects an empty file", async () => {
    const result = await parseCsvFile(csvFile(""));
    expect(result.ok).toBe(false);
    expect(result.fileErrors).toContain("File is empty.");
  });

  it("rejects a file with a header but no data rows", async () => {
    const result = await parseCsvFile(csvFile(`${HEADER}\n`));
    expect(result.ok).toBe(false);
    expect(result.fileErrors).toContain("No event rows found below the header row.");
  });

  it("rejects a file over the row cap", async () => {
    const rows = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) =>
      rowFor({ title: `Event ${i}`, event_type: "social", event_date: "2026-09-15", city: "boston" })
    );
    const result = await parseCsvFile(csvFile(`${HEADER}\n${rows.join("\n")}\n`));
    expect(result.ok).toBe(false);
    expect(result.fileErrors[0]).toContain(`Maximum supported is ${CSV_MAX_ROWS}`);
  });
});

describe("parseCsvFile — column detection", () => {
  it("reports missing required columns by name", async () => {
    const result = await parseCsvFile(csvFile("title,city\nSalsa,boston\n"));
    expect(result.ok).toBe(false);
    expect(result.fileErrors[0]).toContain("event_type");
    expect(result.fileErrors[0]).toContain("event_date");
  });

  it("flags unexpected columns without blocking the import", async () => {
    const result = await parseCsvFile(
      csvFile(`${HEADER},surprise\n${rowFor({ title: "Salsa", event_type: "social", event_date: "2026-09-15", city: "boston" })},junk\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.unexpectedColumns).toEqual(["surprise"]);
  });
});

describe("parseCsvFile — CSV syntax handling", () => {
  it("parses a valid file into keyed rows", async () => {
    const result = await parseCsvFile(
      csvFile(`${HEADER}\n${rowFor({ title: "Salsa Social", event_type: "social", event_date: "2026-09-15", city: "boston" })}\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe("Salsa Social");
  });

  it("keeps commas inside quoted fields intact", async () => {
    const result = await parseCsvFile(
      csvFile(`title,event_type,event_date,city,address\n"Salsa Social","social","2026-09-15","boston","100 Main St, Boston, MA"\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows[0].address).toBe("100 Main St, Boston, MA");
  });

  it("handles escaped double quotes inside a quoted field", async () => {
    const result = await parseCsvFile(
      csvFile(`title,event_type,event_date,city\n"The ""Big"" Social",social,2026-09-15,boston\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows[0].title).toBe('The "Big" Social');
  });

  it("ignores completely empty rows", async () => {
    const result = await parseCsvFile(
      csvFile(`title,event_type,event_date,city\nSalsa,social,2026-09-15,boston\n\n\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("trims accidental surrounding whitespace in cells and headers", async () => {
    const result = await parseCsvFile(
      csvFile(`  title , event_type ,event_date,city\n  Salsa Social  ,social,2026-09-15,boston\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows[0].title).toBe("Salsa Social");
  });

  it("reads UTF-8 characters correctly", async () => {
    const result = await parseCsvFile(
      csvFile(`title,event_type,event_date,city\nBachata Sensual — Café Niño,social,2026-09-15,boston\n`)
    );
    expect(result.ok).toBe(true);
    expect(result.rows[0].title).toBe("Bachata Sensual — Café Niño");
  });
});
