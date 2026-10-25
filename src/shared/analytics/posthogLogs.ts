import posthog from "posthog-js";

export const posthogLogsConfig = {
  serviceName: "salsa-segura-web",
  environment: import.meta.env.MODE,
};

type EventSubmissionLogAttributes = {
  city: string;
  event_type: string;
  has_flyer: boolean;
  flyer_count?: number;
  is_authenticated: boolean;
};

// This wrapper is the only logger routed to PostHog. Do not enable console
// capture: existing application and dependency logs must remain local.
export const posthogSubmissionLogger = {
  submitted(attributes: EventSubmissionLogAttributes) {
    posthog.logger.info("event submission persisted", attributes);
  },
  failed(
    attributes: Pick<EventSubmissionLogAttributes, "has_flyer" | "flyer_count" | "is_authenticated">
  ) {
    posthog.logger.warn("event submission failed", attributes);
  },
};
