import { record, count } from "../../../../supabase/functions/_shared/analyticsSummary";
export interface AnalyticsPreferences { frequency:"disabled"|"daily"|"weekly"; email_enabled:boolean; submission_backlog:boolean; metro_inventory:boolean; event_data_quality:boolean; analytics_data_health:boolean }
export interface AnalyticsAlert { condition_key:string;category:string;priority:"critical"|"warning"|"informational";title:string;destination:string;state:"active"|"resolved";detected_at:string;resolved_at:string|null;lifecycle:number }
export interface ScheduledReport { id:string;frequency:"daily"|"weekly";period_from:string;period_to:string;generated_at:string;status:"success"|"error";summary:unknown }
export interface Monitoring { preferences:AnalyticsPreferences;alerts:AnalyticsAlert[];reports:ScheduledReport[];health:{status:"success"|"unavailable"|"error"|"stale";evaluated_at:string|null};alertLimit:number;reportLimit:number }
const booleanKeys=["email_enabled","submission_backlog","metro_inventory","event_data_quality","analytics_data_health"] as const;
const instant=(value:unknown):value is string=>typeof value==="string" && Number.isFinite(Date.parse(value));
export function parsePreferences(raw:unknown):AnalyticsPreferences {
 const value=record(raw);
 if(!["disabled","daily","weekly"].includes(String(value.frequency)) || !booleanKeys.every(key=>typeof value[key]==="boolean"))throw Error("Notification preferences are unavailable. Try again.");
 return {frequency:value.frequency as AnalyticsPreferences["frequency"],...Object.fromEntries(booleanKeys.map(key=>[key,value[key]]))} as AnalyticsPreferences;
}
export function parseMonitoring(raw:unknown):Monitoring {
 const source=record(raw),health=record(source.health);
 if(!Array.isArray(source.alerts) || !Array.isArray(source.reports) || !["success","unavailable","error","stale"].includes(String(health.status)) || !(health.evaluated_at===null || instant(health.evaluated_at)) || count(source.alert_limit)===null || count(source.report_limit)===null)throw Error("Analytics monitoring is unavailable. Try again.");
 const alerts=source.alerts.map(value=>{
  const row=record(value);
  if(typeof row.condition_key!=="string" || typeof row.category!=="string" || typeof row.title!=="string" || !["critical","warning","informational"].includes(String(row.priority)) || !["active","resolved"].includes(String(row.state)) || !["/admin/analytics","/admin/events","/admin/submissions"].includes(String(row.destination)) || !instant(row.detected_at) || !(row.resolved_at===null || instant(row.resolved_at)) || count(row.lifecycle)===null)throw Error("Analytics alerts are unavailable. Try again.");
  return row as unknown as AnalyticsAlert;
 });
 const reports=source.reports.map(value=>{
  const row=record(value);
  if(typeof row.id!=="string" || !["daily","weekly"].includes(String(row.frequency)) || !["success","error"].includes(String(row.status)) || !instant(row.period_from) || !instant(row.period_to) || !instant(row.generated_at) || Date.parse(row.period_from)>=Date.parse(row.period_to) || (row.status==="success" && (!row.summary || typeof row.summary!=="object")))throw Error("Scheduled reports are unavailable. Try again.");
  return row as unknown as ScheduledReport;
 });
 return {preferences:parsePreferences(source.preferences),alerts,reports,health:health as unknown as Monitoring["health"],alertLimit:source.alert_limit as number,reportLimit:source.report_limit as number};
}
