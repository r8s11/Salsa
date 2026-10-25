import ReactDOM from "react-dom/client";
import posthog from "posthog-js";
import App from "./app/App";
import { Providers } from "./app/providers";
import { posthogLogsConfig } from "./shared/analytics/posthogLogs";
import "./styles/index.css";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim();

if (!posthogKey && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured"
  );
}
if (!posthogHost && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured"
  );
}
if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_exceptions: true,
    logs: posthogLogsConfig,
  });
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <Providers>
    <App />
  </Providers>
);
