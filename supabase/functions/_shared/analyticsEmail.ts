import { layout, plainText, type EmailContent } from "./emailLayout.ts";
import { record, summaryRows, easternTimestamp } from "./analyticsSummary.ts";
export function analyticsEmail(kind: "report" | "alert", payload: unknown, origin: string): EmailContent {
 const source=record(payload);
 const heading=kind==="report" ? `${source.frequency==="weekly" ? "Weekly" : "Daily"} Platform Report` : "Critical platform condition";
 const rows: Array<[string,string]> = kind==="report" ? summaryRows(source.summary).map(row=>[`${row.section} — ${row.label}`,`${row.value===null ? "Unavailable" : row.value.toLocaleString("en-US")}${row.section!=="Current operational health" ? `; ${row.comparison}${row.previous===null ? "" : ` (previous: ${row.previous})`}` : ""}`]) : [["Needs attention",String(source.title ?? "Analytics condition needs review")]];
 const top=record(record(source.summary).engagement).top_events;
 if(kind==="report" && Array.isArray(top))for(const value of top.slice(0,5)) {
  const event=record(value);
  rows.push(["Top event by detail views",`${String(event.title)} — ${String(event.detail_views)} recorded views`]);
 }
 const paragraphs=kind==="report" ? [`Activity: ${easternTimestamp(String(source.from))} inclusive to ${easternTimestamp(String(source.to))} exclusive.`, `Generated ${easternTimestamp(String(source.generated_at))} Eastern. Operational health describes current state at generation, not historical inventory.`,"Approval activity is unavailable: no authoritative approval timestamps. Engagement reflects retained recorded interactions only; missing tracking history is not zero."] : ["A new critical condition needs administrator review. No administrative action has been taken automatically."];
 const parts={platformName:"SalsaSegura",heading,paragraphs,rows,cta:{label:"View Admin Analytics",url:new URL("/admin/analytics",origin).toString()},footerLines:[`Manage notification preferences: ${new URL("/admin/analytics#analytics-notifications",origin).toString()}`,"Administrator analytics notifications only. Persistent conditions are not repeatedly emailed."]};
 return {subject:`SalsaSegura — ${heading}`,html:layout(parts),text:plainText(parts)};
}
