import ReactDOM from "react-dom/client";
import posthog from "posthog-js";
import App from "./app/App";
import { Providers } from "./app/providers";
import { posthogLogsConfig } from "./shared/analytics/posthogLogs";
import "./styles/index.css";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim();

// `phc_` is the only browser-safe PostHog key. `phs_` project-secret and `phx_`
// personal keys grant private-data access and must never reach the bundle.
if (posthogKey && !posthogKey.startsWith("phc_")) {
  throw new Error(
    "VITE_POSTHOG_KEY must be the public project token (phc_…). Secret (phs_) and personal (phx_) keys are server credentials; rotate this one and use the Project API key from PostHog project settings."
  );
}
if (!posthogHost && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured"
  );
}
if (posthogKey && posthogHost) {
  // Retire this project's old persisted identity before the memory-only SDK
  // starts. Do not clear authentication storage or other projects' analytics.
  const legacyName = `ph_${posthogKey}_posthog`;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === legacyName || key.startsWith(`${legacyName}_`)) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be blocked; analytics must not prevent application startup.
  }
  const domains = location.hostname.split(".");
  try {
    document.cookie = `${legacyName}=; Max-Age=0; Path=/`;
    while (domains.length > 1) {
      document.cookie = `${legacyName}=; Max-Age=0; Path=/; Domain=${domains.join(".")}`;
      domains.shift();
    }
  } catch {
    // Sandboxed contexts may deny cookie access.
  }
  posthog.init(posthogKey, {
    api_host: posthogHost,
    // Cookieless: no cookie or localStorage ID. Anonymous identity lasts for
    // this page only; existing signed-in identify calls still identify users.
    // Anonymous repeat-visitor measurement lives in cookieless Umami.
    persistence: "memory",
    capture_exceptions: true,
    logs: posthogLogsConfig,
  });
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <Providers>
    <App />
  </Providers>
);
