import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const ERROR = 17; // SeverityNumber.ERROR

/** PostHog Logs over OTLP. Null without POSTHOG_PROJECT_TOKEN (a phc_ project token), so local runs stay silent. */
export function createPosthogLogs(env = process.env) {
  const token = env.POSTHOG_PROJECT_TOKEN;
  if (!token) return null;
  const host = (env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
  const provider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "salsa-segura-api" }),
    processors: [new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({
        url: `${host}/i/v1/logs`,
        headers: { Authorization: `Bearer ${token}` },
        timeoutMillis: 2000,
      }),
    })],
  });
  const logger = provider.getLogger("itinerary-page");

  return {
    /** Flushes before resolving: a Consumption-plan instance may freeze once the response is sent. */
    async error(message, error, attributes = {}) {
      logger.emit({
        severityNumber: ERROR,
        severityText: "ERROR",
        body: message,
        attributes: { ...attributes, "error.message": error instanceof Error ? error.message : String(error) },
        exception: error,
      });
      await provider.forceFlush().catch(() => {});
    },
  };
}
