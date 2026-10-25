/// <reference lib="es2021.string" />
// This suite exercises Deno email modules; the ES2020 browser bundle never imports them.
import { describe,it,expect } from "vitest";
import { createAnalyticsWorker, type WorkerDependencies } from "../../../../supabase/functions/_shared/analyticsWorker";
import { analyticsEmail } from "../../../../supabase/functions/_shared/analyticsEmail";
function harness(overrides: Partial<WorkerDependencies> = {}) {
 const emails: unknown[] = [], completions: string[] = [];
 const dependencies: WorkerDependencies = {
  secret:"test-secret-12345678901234567890", siteUrl:"https://www.salsasegura.com", from:"SalsaSegura <analytics@example.com>",
  evaluate: async()=>({status:"success"}), due:async()=>["delivery"],
  claim:async()=>({admin_id:"trusted-admin",token:"lease",kind:"report",idempotency_key:"stable-key",payload:{frequency:"daily",from:"2026-03-08T05:00:00Z",to:"2026-03-09T04:00:00Z",generated_at:"2026-03-09T13:00:00Z",summary:{activity:{events:18},operational:{pending:0},engagement:null}}}),
  allowed:async()=>true, recipient:async()=>({email:"trusted@example.com",role:"admin",banned:false}),
  send:async(email,key)=>{emails.push({email,key});return {data:{id:"provider-id"},error:null};},
  finish:async(_id,_token,status)=>{completions.push(status);return true;},log:()=>{},...overrides,
 };
 return { handler:createAnalyticsWorker(dependencies),emails,completions };
}
const request=(secret="test-secret-12345678901234567890",body="{}")=>new Request("https://local/functions/v1/admin-analytics-monitor",{method:"POST",headers:{"x-analytics-scheduler-secret":secret},body});
describe("authorized analytics delivery",()=>{
 it("rejects scheduler impersonation before any evaluation",async()=>{
  const h=harness({evaluate:async()=>{throw Error("must not run");}});
  expect((await h.handler(request("wrong"))).status).toBe(401);expect(h.emails).toEqual([]);
 });
 it("ignores arbitrary body recipients and uses trusted account",async()=>{
  const h=harness();expect((await h.handler(request(undefined,'{"to":"attacker@example.com"}'))).status).toBe(200);
  expect(h.emails[0]).toMatchObject({email:{to:"trusted@example.com"},key:"stable-key"});
  expect(h.completions).toEqual(["sent"]);
 });
 it.each(["user","moderator","organizer","host"])("never emails %s accounts",async role=>{
  const h=harness({recipient:async()=>({email:"trusted@example.com",role,banned:false})});
  await h.handler(request());expect(h.emails).toEqual([]);expect(h.completions).toEqual(["suppressed"]);
 });
 it("rechecks opt-out after claiming",async()=>{
  const h=harness({allowed:async()=>false});await h.handler(request());expect(h.emails).toEqual([]);expect(h.completions).toEqual(["suppressed"]);
 });
 it("does not send when another execution owns delivery",async()=>{
  const h=harness({claim:async()=>null});await h.handler(request());expect(h.emails).toEqual([]);
 });
 it("records provider failure without reporting delivery success",async()=>{
  const h=harness({send:async()=>({data:null,error:{name:"rate_limit",message:"rate limit"}})});
  expect((await h.handler(request())).status).toBe(503);expect(h.completions).toEqual(["failed"]);
 });
 it("records network failure and lets durable outbox control retries",async()=>{
  const h=harness({send:async()=>{throw Error("network timeout");}});expect((await h.handler(request())).status).toBe(503);expect(h.completions).toEqual(["failed"]);
 });
 it("captures claim failures instead of consuming a delivery",async()=>{
  const h=harness({claim:async()=>{throw Error("database unavailable");}});expect((await h.handler(request())).status).toBe(503);expect(h.emails).toEqual([]);
 });
 it("does not accept unsafe configured destinations",async()=>{
  const h=harness({siteUrl:"javascript:alert(1)"});expect((await h.handler(request())).status).toBe(503);expect(h.emails).toEqual([]);
 });
 it("generates dashboard reports without email configuration when no delivery is opted in",async()=>{
  const h=harness({siteUrl:"",from:"",due:async()=>[]});expect((await h.handler(request())).status).toBe(200);expect(h.emails).toEqual([]);
 });
 it("uses escaped shared branding, real counts and preference link",()=>{
  const email=analyticsEmail("report",{frequency:"weekly",from:"2026-03-02T05:00:00Z",to:"2026-03-09T04:00:00Z",generated_at:"2026-03-09T13:00:00Z",summary:{activity:{events:18},previous_activity:{events:10},operational:{pending:0}}},"https://www.salsasegura.com");
  expect(email.text).toContain("Events created: 18");expect(email.text).toContain("Pending moderation: 0");expect(email.text).toContain("/admin/analytics#analytics-notifications");expect(email.html).toContain("/images/brand/mark-brand.png");
  expect(analyticsEmail("alert",{title:'<script>alert(1)</script>'},"https://www.salsasegura.com").html).not.toContain("<script>");
 });
});
