import {render,screen,fireEvent,waitFor,within} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter} from "react-router-dom";
import {beforeEach,it,expect,vi} from "vitest";
import AnalyticsMonitoring from "./AnalyticsMonitoring";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),save:vi.fn(),auth:{user:{id:"admin"} as {id:string}|null,isAdmin:true,loading:false}}));
vi.mock("../../api/analyticsRepo",()=>({fetchAnalyticsMonitoring:mocks.fetch,saveAnalyticsPreferences:mocks.save}));
vi.mock("../../../../contexts/useAuth",()=>({useAuth:()=>mocks.auth}));
const preferences={frequency:"disabled" as const,email_enabled:false,submission_backlog:true,metro_inventory:true,event_data_quality:true,analytics_data_health:true};
const snapshot={preferences,alerts:[{condition_key:"low",category:"limited_metro_inventory",priority:"warning",title:"Boston has 1 event",destination:"/admin/events",state:"active",detected_at:"2026-10-12T13:00:00Z",resolved_at:null,lifecycle:1},{condition_key:"backlog",category:"submission_backlog",priority:"critical",title:"3 submissions waiting over 48 hours",destination:"/admin/submissions",state:"active",detected_at:"2026-10-12T13:00:00Z",resolved_at:null,lifecycle:1}],reports:[],health:{status:"success",evaluated_at:"2026-10-12T13:00:00Z"},alertLimit:100,reportLimit:20};
function setup(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><AnalyticsMonitoring/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.auth={user:{id:"admin"},isAdmin:true,loading:false};mocks.fetch.mockResolvedValue(snapshot);mocks.save.mockImplementation(async value=>value);});
it("orders critical first and filters priority without losing control focus",async()=>{
 setup();await screen.findByText("3 submissions waiting over 48 hours");
 const list=screen.getByRole("list",{name:"Active analytics alerts"});
 expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("3 submissions");
 const filter=screen.getByLabelText("Alert priority");filter.focus();fireEvent.change(filter,{target:{value:"critical"}});
 expect(screen.queryByText("Boston has 1 event")).not.toBeInTheDocument();expect(filter).toHaveFocus();
});
it("keeps unsaved changes visible and confirms persistence only after successful save",async()=>{
 setup();await screen.findByLabelText("Report frequency");
 fireEvent.change(screen.getByLabelText("Report frequency"),{target:{value:"weekly"}});fireEvent.click(screen.getByLabelText("Email delivery"));
 expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Save Preferences"}));
 await screen.findByText("Preferences saved");expect(screen.getByLabelText("Report frequency")).toHaveValue("weekly");expect(screen.getByLabelText("Email delivery")).toBeChecked();
});
it("does not show saved success on persistence failure",async()=>{
 mocks.save.mockRejectedValue(Error("Access changed"));setup();await screen.findByLabelText("Report frequency");fireEvent.click(screen.getByLabelText("Email delivery"));fireEvent.click(screen.getByRole("button",{name:"Save Preferences"}));
 await screen.findByText("Access changed");expect(screen.getByText("Unsaved changes")).toBeInTheDocument();expect(screen.queryByText("Preferences saved")).not.toBeInTheDocument();
});
it("keeps optional monitoring failure recoverable",async()=>{
 mocks.fetch.mockRejectedValue(Error("offline"));setup();await screen.findByText("Analytics monitoring is unavailable. Earlier analytics remain available.");expect(screen.getByRole("button",{name:"Retry monitoring"})).toBeInTheDocument();
});
it("preserves unsaved preferences while failed refresh hides stale alerts",async()=>{
 setup();await screen.findByLabelText("Report frequency");
 fireEvent.change(screen.getByLabelText("Report frequency"),{target:{value:"weekly"}});
 mocks.fetch.mockRejectedValue(Error("offline"));
 fireEvent.click(screen.getByRole("button",{name:"Refresh monitoring"}));
 await screen.findByText("Analytics monitoring is unavailable. Earlier analytics remain available.");
 expect(screen.queryByText("3 submissions waiting over 48 hours")).not.toBeInTheDocument();
 expect(screen.getByLabelText("Report frequency")).toHaveValue("weekly");
 expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
});
it("focuses notification settings for deep links after asynchronous loading",async()=>{
 window.history.replaceState(null,"","#analytics-notifications");
 try {
  setup();
  await screen.findByRole("heading",{name:"Analytics Notifications"});
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Analytics Notifications"})).toHaveFocus());
 } finally {window.history.replaceState(null,"",window.location.pathname);}
});
it("hides cached results immediately when admin access is revoked",async()=>{
 const view=setup();await screen.findByText("3 submissions waiting over 48 hours");mocks.auth.isAdmin=false;
 view.rerender(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AnalyticsMonitoring/></MemoryRouter></QueryClientProvider>);
 await waitFor(()=>expect(screen.queryByText("3 submissions waiting over 48 hours")).not.toBeInTheDocument());
});
