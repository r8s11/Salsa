import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../contexts/useAuth";
import { fetchAnalyticsMonitoring, saveAnalyticsPreferences } from "../../api/analyticsRepo";
import type { AnalyticsAlert, AnalyticsPreferences, ScheduledReport } from "../../model/analyticsMonitoring";
import { summaryRows, record } from "../../../../../supabase/functions/_shared/analyticsSummary";
import { operationalDate } from "../../model/operationalAnalytics";
import "./OperationalInsights.css";
import "./AnalyticsMonitoring.css";
const preferenceLabels={submission_backlog:"Submission backlog",metro_inventory:"Metro inventory",event_data_quality:"Critical event data quality",analytics_data_health:"Analytics data health"};
function Preferences({ initial, onSaved }: { initial: AnalyticsPreferences; onSaved:()=>void }) {
 const [saved,setSaved]=useState(initial),[draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirmed,setConfirmed]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(window.location.hash==="#analytics-notifications") {
   heading.current?.focus({preventScroll:true});
   heading.current?.closest("form")?.scrollIntoView?.({block:"start"});
  }
 },[]);
 const dirty=JSON.stringify(saved)!==JSON.stringify(draft);
 return <form id="analytics-notifications" className="admin-card analytics-monitoring__preferences" aria-labelledby="analytics-preferences-title" onSubmit={async event=>{
  event.preventDefault();if(busy || !dirty)return;setBusy(true);setError(null);setConfirmed(false);
  try {const result=await saveAnalyticsPreferences(draft);setSaved(result);setDraft(result);setConfirmed(true);onSaved();}catch(cause){setError(cause instanceof Error?cause.message:"Preferences were not saved. Try again.");}finally{setBusy(false);}
 }}>
  <h2 id="analytics-preferences-title" ref={heading} tabIndex={-1}>Analytics Notifications</h2>
  <p className="operational-insights__note">Your administrator account only. Reports are saved here even when email is off. Enabling a schedule starts with its next due period.</p>
  <fieldset disabled={busy}><legend>Scheduled reports</legend>
   <label className="analytics-monitoring__field">Report frequency<select className="admin-input" value={draft.frequency} onChange={event=>{setDraft({...draft,frequency:event.target.value as AnalyticsPreferences["frequency"]});setConfirmed(false);}}><option value="disabled">Disabled</option><option value="daily">Daily — 9:00 AM Eastern</option><option value="weekly">Weekly — Monday, 9:00 AM Eastern</option></select></label>
   <label className="analytics-monitoring__check"><input type="checkbox" checked={draft.email_enabled} onChange={event=>{setDraft({...draft,email_enabled:event.target.checked});setConfirmed(false);}}/>Email delivery</label>
   <p className="operational-insights__note">Optional report digests and new critical-condition emails. Sent only to your trusted account address; no repeated emails for unchanged conditions.</p>
  </fieldset>
  <fieldset disabled={busy}><legend>Operational alerts</legend>{Object.entries(preferenceLabels).map(([key,label])=><label className="analytics-monitoring__check" key={key}><input type="checkbox" checked={draft[key as keyof typeof preferenceLabels]} onChange={event=>{setDraft({...draft,[key]:event.target.checked});setConfirmed(false);}}/>{label}</label>)}</fieldset>
  {error && <p role="alert" className="admin-field__error">{error}</p>}
  <div className="analytics-monitoring__controls"><button className="admin-btn admin-btn--primary" type="submit" disabled={busy || !dirty}>{busy?"Saving…":"Save Preferences"}</button>{dirty && <button type="button" className="admin-btn admin-btn--secondary" disabled={busy} onClick={()=>{setDraft(saved);setError(null);setConfirmed(false);}}>Discard changes</button>}<p role="status">{dirty?"Unsaved changes":confirmed?"Preferences saved":"No unsaved changes"}</p></div>
 </form>;
}
function Alerts({ alerts, label }: { alerts:AnalyticsAlert[];label:string }) {
 return <ul className="operational-insights__actions" aria-label={label}>{alerts.map(alert=><li key={alert.condition_key}>
  <div><h3>{alert.title}</h3><p>Detected {operationalDate(alert.detected_at)}{alert.state==="resolved"?`; resolved ${operationalDate(alert.resolved_at)}`:""}</p></div>
  <span className={`operational-insights__priority operational-insights__priority--${alert.priority==="warning"?"attention":alert.priority}`}>{alert.priority==="critical"?"Critical":alert.priority==="warning"?"Warning":"Informational"}</span>
  <Link className="admin-btn admin-btn--secondary" to={alert.destination}>{alert.category==="submission_backlog"?"Review Submissions":alert.category.includes("metro")?"Review Metro Inventory":alert.category==="event_data_quality"?"Review Events":"View Analytics"}</Link>
 </li>)}</ul>;
}
function Report({ report }: {report:ScheduledReport}) {
 const rows=summaryRows(report.summary),source=record(report.summary),engagement=record(source.engagement);
 return <details className="operational-insights__detail"><summary>{report.frequency==="daily"?"Daily":"Weekly"} report — {operationalDate(report.period_to).slice(0,10)} · {report.status==="error"?"Generation failed":"Ready"}</summary>
  <div className="operational-insights__detail-body"><p className="operational-insights__note">Activity from {operationalDate(report.period_from)} inclusive to {operationalDate(report.period_to)} exclusive. Generated {operationalDate(report.generated_at)}. Inventory and backlog describe current state at generation.</p>
  {report.status==="error"?<p role="alert">Required analytics were unavailable. No incomplete report is marked successful; generation retries while this remains the current due period.</p>:<>
   <table className="operational-insights__table" aria-label={`${report.frequency} platform summary`}><thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Comparison</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.section}-${row.key}`}><th scope="row">{row.label}<small>{row.section}</small></th><td><span className="operational-insights__mobile-label" aria-hidden="true">Value</span><span>{row.value===null?"Unavailable":row.value.toLocaleString()}</span></td><td><span className="operational-insights__mobile-label" aria-hidden="true">Comparison</span><span>{row.comparison}{row.section!=="Current operational health" && row.previous!==null?` (previous: ${row.previous.toLocaleString()})`:""}</span></td></tr>)}</tbody></table>
   <p className="operational-insights__note">Approval activity unavailable: no authoritative approval history. {source.engagement===null?"Engagement unavailable for this reporting period.":`Engagement covers retained recorded interactions, not unique people or completed purchases. Earliest retained record: ${operationalDate(typeof engagement.first_recorded_at==="string"?engagement.first_recorded_at:null)}. Comparison requires a fully covered previous period; no fabricated history.`}</p>
   {Array.isArray(engagement.top_events) && engagement.top_events.length>0 && <div><h3>Top-performing events by recorded detail views</h3><ul>{engagement.top_events.map(value=>{const event=record(value);return <li key={String(event.id)}><Link className="operational-insights__link" to={`/admin/events?edit=${encodeURIComponent(String(event.id))}`}>{String(event.title)}</Link> — {String(event.detail_views)} views</li>;})}</ul></div>}
  </>}
  </div>
 </details>;
}
export default function AnalyticsMonitoring() {
 const {user,isAdmin,loading}=useAuth();
 const enabled=Boolean(user && isAdmin && !loading);
 const query=useQuery({queryKey:["admin-analytics-monitoring",user?.id],queryFn:fetchAnalyticsMonitoring,enabled,retry:false,refetchInterval:60_000});
 const [priority,setPriority]=useState("all");
 if(!enabled)return null;
 const data=query.isError?null:query.data;
 const active=(data?.alerts??[]).filter(alert=>alert.state==="active" && (priority==="all" || alert.priority===priority)).sort((a,b)=>({critical:0,warning:1,informational:2}[a.priority]-{critical:0,warning:1,informational:2}[b.priority]));
 const history=(data?.alerts??[]).filter(alert=>alert.state==="resolved");
 return <section className="operational-insights analytics-monitoring" aria-label="Analytics monitoring">
  <section className="admin-card" aria-labelledby="analytics-alerts-title"><div className="analytics-monitoring__controls"><h2 id="analytics-alerts-title">Analytics Alerts</h2><label className="analytics-monitoring__field">Alert priority<select className="admin-input" value={priority} onChange={event=>setPriority(event.target.value)}><option value="all">All priorities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="informational">Informational</option></select></label><button type="button" className="admin-btn admin-btn--secondary" aria-disabled={query.isFetching} onClick={()=>{if(!query.isFetching)void query.refetch();}}>{query.isError?"Retry monitoring":"Refresh monitoring"}</button></div>
   {query.isPending?<div className="operational-insights__loading" aria-busy="true">Loading analytics monitoring…<div className="admin-skeleton"/></div>:query.isError?<p role="alert">Analytics monitoring is unavailable. Earlier analytics remain available.</p>:data && <>
    <p className="operational-insights__note">Evaluation: {data.health.status}. Last checked {operationalDate(data.health.evaluated_at)}. Conditions resolve only when underlying issues clear.</p>
    {data.health.status!=="success" && <p role="status" className="operational-insights__note">{data.health.status==="stale"?"Scheduled evaluation is stale (over 45 minutes). Ask the deployment operator to check the scheduler.":data.health.status==="unavailable"?"Monitoring has not run yet. Scheduler activation requires a separately authorized deployment.":"An analytics source or email delivery failed. Missing data is not zero; earlier conditions remain unresolved until verified."}</p>}
    {active.length===0?<p className="operational-insights__note">No active alerts match your preferences and priority filter.</p>:<Alerts alerts={active.slice(0,6)} label="Active analytics alerts"/>}
    {active.length>6 && <details className="operational-insights__detail"><summary>View all {active.length} matching alerts</summary><Alerts alerts={active.slice(6)} label="Additional analytics alerts"/></details>}
    <details className="operational-insights__detail"><summary>Resolved history ({history.length})</summary>{history.length?<Alerts alerts={history} label="Resolved analytics alerts"/>:<p className="operational-insights__note">No resolved conditions in recent history.</p>}</details>
    <p className="operational-insights__note">Most recent {data.alertLimit} active/history records maximum; critical active conditions first. Metro screening minimum: five upcoming approved events, matching Phase 5 defaults.</p>
   </>}
  </section>
  {data && <>
   <section className="admin-card" aria-labelledby="analytics-scheduled-title"><h2 id="analytics-scheduled-title">Scheduled Reports</h2><p className="operational-insights__note">Previous complete Eastern calendar day or Monday–Sunday week, delivered at 9:00 AM Eastern. Comparison uses preceding equivalent calendar period. Zero baselines have no growth comparison.</p>{data.reports.length?data.reports.map(report=><Report key={report.id} report={report}/>):<p className="operational-insights__note">No scheduled reports yet. Enable daily or weekly reports below; email is optional.</p>}<p className="operational-insights__note">Latest {data.reportLimit} saved report runs. Reports remain available to authorized administrators even after opting out.</p></section>
  </>}
  {query.data && <Preferences key={user?.id} initial={query.data.preferences} onSaved={()=>{void query.refetch();}}/>}
 </section>;
}
