export interface SummaryRow { key: string; section: string; label: string; value: number | null; previous: number | null; comparison: string }
export function record(value: unknown): Record<string, unknown> {
 return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function count(value: unknown): number | null {
 return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
const ACTIVITY = { events: "Events created", accounts: "New registered users", submissions: "Submissions received", organizers: "New organizers", venues: "New venues" };
const HEALTH = { pending: "Pending moderation", over_48: "Submissions older than 48 hours", upcoming_events: "Upcoming approved events", active_metros: "Active metropolitan areas", low_inventory: "Metros below inventory minimum", quality_events: "Events with data-quality issues", critical_quality: "Events with critical required-data issues" };
const ENGAGEMENT = { detail_views: "Event detail views", rsvp_clicks: "RSVP clicks", ticket_clicks: "Ticket clicks" };
function comparison(value:number|null,before:number|null):string {
 return value===null || before===null || before===0 ? "No comparison available" : value>before ? "Increased" : value<before ? "Decreased" : "No change";
}
/** Dashboard and email consume the same persisted database snapshot; never recalculate metrics here. */
export function summaryRows(raw: unknown): SummaryRow[] {
 const source = record(raw), activity = record(source.activity), previous = record(source.previous_activity), operational = record(source.operational), engagement = record(record(source.engagement).summary);
 const rows: SummaryRow[] = [];
 for (const [key,label] of Object.entries(ACTIVITY)) {
  const value=count(activity[key]), before=count(previous[key]);
  rows.push({key,section:"Platform activity",label,value,previous:before,comparison:comparison(value,before)});
 }
 for (const [key,label] of Object.entries(HEALTH)) rows.push({key,section:"Current operational health",label,value:count(operational[key]),previous:null,comparison:"Current state at generation"});
 if (source.engagement !== null && source.engagement !== undefined) {
  for (const [key,label] of Object.entries(ENGAGEMENT)) {
   const value=count(engagement[key]),before=count(record(source.previous_engagement)[key]);
   rows.push({key,section:"Recorded engagement",label,value,previous:before,comparison:comparison(value,before)});
  }
 }
 return rows;
}
export function easternTimestamp(value: string): string {
 return new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}
