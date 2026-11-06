import { app } from "@azure/functions";
import { createItineraryPage } from "../lib/itineraryPageHandler.mjs";
import { createPosthogLogs } from "../lib/posthogLogs.mjs";

export const itineraryPage = createItineraryPage({ logs: createPosthogLogs() });

app.http("itinerary-page", {
  route: "itinerary-page",
  methods: ["GET", "HEAD"],
  authLevel: "anonymous",
  handler: itineraryPage,
});
