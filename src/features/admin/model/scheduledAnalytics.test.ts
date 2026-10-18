import { describe, it, expect } from "vitest";
import { summaryRows } from "../../../../supabase/functions/_shared/analyticsSummary";

describe("scheduled report summaries", () => {
 it("distinguishes zero, unavailable, baseline zero and real changes", () => {
  const rows = summaryRows({activity:{events:0,accounts:3,submissions:4,organizers:2,venues:null},previous_activity:{events:2,accounts:0,submissions:4,organizers:1,venues:2},operational:{pending:0}});
  expect(rows.find(r=>r.key==="events")).toMatchObject({value:0,comparison:"Decreased"});
  expect(rows.find(r=>r.key==="accounts")).toMatchObject({value:3,comparison:"No comparison available"});
  expect(rows.find(r=>r.key==="submissions")).toMatchObject({comparison:"No change"});
  expect(rows.find(r=>r.key==="organizers")).toMatchObject({comparison:"Increased"});
  expect(rows.find(r=>r.key==="venues")).toMatchObject({value:null,comparison:"No comparison available"});
  expect(rows.find(r=>r.key==="pending")).toMatchObject({value:0,section:"Current operational health"});
 });
 it("does not invent engagement history or malformed counts",()=>{
  const rows=summaryRows({activity:{events:-1},operational:{pending:"broken"},engagement:null});
  expect(rows.find(r=>r.key==="events")?.value).toBeNull();
  expect(rows.find(r=>r.key==="pending")?.value).toBeNull();
  expect(rows.some(r=>r.section==="Recorded engagement")).toBe(false);
 });
});
