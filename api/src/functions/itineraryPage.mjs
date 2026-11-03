import { app } from "@azure/functions";
import { createItineraryPage } from "../lib/itineraryPageHandler.mjs";

export const itineraryPage = createItineraryPage();

app.http("itinerary-page", {
  route: "itinerary-page",
  methods: ["GET", "HEAD"],
  authLevel: "anonymous",
  handler: itineraryPage,
});
