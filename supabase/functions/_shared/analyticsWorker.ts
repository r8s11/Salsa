import { analyticsEmail } from "./analyticsEmail.ts";
import { classifyResendFailure, type EmailContent, type ResendResult } from "./emailLayout.ts";
export interface DeliveryClaim {admin_id:string;token:string;kind:"report"|"alert";payload:unknown;idempotency_key:string}
export interface WorkerDependencies {
 secret:string;siteUrl:string;from:string;
 evaluate:()=>Promise<{status:string}>;due:()=>Promise<string[]>;
 claim:(id:string)=>Promise<DeliveryClaim|null>;allowed:(id:string)=>Promise<boolean>;
 recipient:(id:string)=>Promise<{email:string|null;role:string|null;banned:boolean}|null>;
 send:(email:EmailContent & {to:string;from:string},key:string)=>Promise<ResendResult>;
 finish:(id:string,token:string,status:"sent"|"failed"|"suppressed",error:string|null)=>Promise<boolean>;
 log:(message:string,details:Record<string,unknown>)=>void;
}
async function matchesSecret(actual:string, expected:string): Promise<boolean> {
 if(expected.length<32)return false;
 const encoder=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(actual)),crypto.subtle.digest("SHA-256",encoder.encode(expected))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let difference=0;
 for(let index=0;index<x.length;index++)difference|=x[index]^y[index];
 return difference===0;
}
export function createAnalyticsWorker(dependencies:WorkerDependencies) {
 return async(request:Request):Promise<Response>=>{
  if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
  if(!await matchesSecret(request.headers.get("x-analytics-scheduler-secret")??"",dependencies.secret))return Response.json({error:"Unauthorized"},{status:401});
  // Body is deliberately ignored. A caller cannot choose recipients, periods or content.
  let failed=false,sent=0;
  try {
   const evaluation=await dependencies.evaluate();
   if(evaluation.status==="error")failed=true;
   for(const id of (await dependencies.due()).slice(0,50)) {
    let claim:DeliveryClaim|null=null;
    try {
     claim=await dependencies.claim(id);if(!claim)continue;
     const recipient=await dependencies.recipient(claim.admin_id);
     if(!recipient || recipient.role!=="admin" || recipient.banned || !recipient.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email) || !await dependencies.allowed(id)) {
      if(!await dependencies.finish(id,claim.token,"suppressed",null))failed=true;
      continue;
     }
     const site=new URL(dependencies.siteUrl);
     if(site.protocol!=="https:" || site.username || site.password || !dependencies.from.trim())throw Error("invalid configuration");
     const email=analyticsEmail(claim.kind,claim.payload,site.origin);
     const result=await dependencies.send({...email,to:recipient.email,from:dependencies.from},claim.idempotency_key);
     if(result.error || !result.data?.id) {
      failed=true;await dependencies.finish(id,claim.token,"failed",classifyResendFailure(result,null));
     } else {
      if(await dependencies.finish(id,claim.token,"sent",null))sent++;else failed=true;
     }
    } catch(cause) {
     failed=true;
     dependencies.log("admin analytics delivery failed",{deliveryId:id,category:"delivery_error"});
     if(claim) {
      try {await dependencies.finish(id,claim.token,"failed",classifyResendFailure(null,cause));} catch {dependencies.log("admin analytics completion unavailable",{deliveryId:id});}
     }
    }
   }
  } catch {
   failed=true;dependencies.log("admin analytics evaluation unavailable",{category:"scheduler_error"});
  }
  return Response.json({status:failed?"error":"success",sent},{status:failed?503:200});
 };
}
