import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import { createAnalyticsWorker, type DeliveryClaim, type WorkerDependencies } from "../_shared/analyticsWorker.ts";
function required(name:string):string {
 const value=Deno.env.get(name);if(!value)throw Error(`${name} is not configured`);return value;
}
export function runtimeDependencies(): WorkerDependencies {
 const service=createClient(required("SUPABASE_URL"),required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const resendKey=Deno.env.get("RESEND_API_KEY");const resend=resendKey?new Resend(resendKey):null;
 async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T> {
  const {data,error}=await service.rpc(name,args);if(error)throw Error("analytics database operation unavailable");return data as T;
 }
 return {
  secret:required("ANALYTICS_SCHEDULER_SECRET"),siteUrl:Deno.env.get("AUTH_EXTERNAL_URL")??"",from:Deno.env.get("AUTH_EMAIL_FROM")??"",
  evaluate:()=>rpc<{status:string}>("admin_analytics_evaluate"),
  due:()=>rpc<string[]>("admin_analytics_due_deliveries"),claim:(id)=>rpc<DeliveryClaim|null>("admin_analytics_claim_delivery",{p_id:id}),
  allowed:(id)=>rpc<boolean>("admin_analytics_delivery_allowed",{p_id:id}),
  recipient:async(id)=>{
   const {data,error}=await service.auth.admin.getUserById(id);if(error)throw Error("recipient authorization unavailable");
   const user=data.user;if(!user)return null;
   return {email:user.email??null,role:typeof user.app_metadata?.role==="string"?user.app_metadata.role:null,banned:Boolean(user.banned_until && Date.parse(user.banned_until)>Date.now())};
  },
  send:async(email,key)=>{
   if(!resend)throw Error("email configuration unavailable");
   return await resend.emails.send(email,{idempotencyKey:key});
  },
  finish:(id,token,status,error)=>rpc<boolean>("admin_analytics_finish_delivery",{p_id:id,p_token:token,p_status:status,p_error:error}),
  log:(message,details)=>console.error(message,details),
 };
}
if(import.meta.main)serve(async(request)=>{
 try {return await createAnalyticsWorker(runtimeDependencies())(request);}
 catch {console.error("admin analytics configuration unavailable");return Response.json({error:"Analytics monitoring unavailable"},{status:503});}
});
