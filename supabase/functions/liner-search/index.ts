import { json } from "https://esm.sh/@supabase/functions-js@0.5.0/src/utilities.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type LinerSearchMode = "web" | "scholar";
type LinerDateRange = "past_day" | "past_week" | "past_month" | "past_year";

interface LinerSearchRequest {
  query: string;
  mode?: LinerSearchMode;
  country_code?: string;
  lang?: string;
  date_range?: LinerDateRange;
  max_results?: number;
}

interface LinerSearchResult {
  title: string;
  url: string;
  hostname: string;
  faviconUrl: string;
  description: string;
  date: string;
  citationCount?: number;
  authors?: string[];
  journal?: string;
}

interface LinerSearchResponse {
  requestId: string;
  results: LinerSearchResult[];
  totalCount: number;
}

const LINER_BASE_URL = "https://platform.liner.com/api/v1/tools/search";
const VALID_DATE_RANGES = new Set<LinerDateRange>([
  "past_day",
  "past_week",
  "past_month",
  "past_year",
]);

function badRequest(message: string) {
  return json({ error: message }, 400);
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("LINER_API_KEY");
  if (!apiKey) {
    return json({ error: "LINER_API_KEY environment variable is not set" }, 500);
  }

  let body: LinerSearchRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { query, mode = "web", country_code, lang, date_range, max_results } = body;

  if (!query || typeof query !== "string") {
    return badRequest("Missing required field: query");
  }

  if (mode !== "web" && mode !== "scholar") {
    return badRequest("mode must be either 'web' or 'scholar'");
  }

  if (mode === "scholar" && country_code) {
    return badRequest("country_code is not supported for scholar search");
  }

  if (date_range && !VALID_DATE_RANGES.has(date_range)) {
    return badRequest("date_range must be one of past_day, past_week, past_month, past_year");
  }

  if (
    max_results !== undefined &&
    (!Number.isInteger(max_results) || max_results < 1 || max_results > 20)
  ) {
    return badRequest("max_results must be an integer between 1 and 20");
  }

  const payload = {
    query,
    ...(country_code ? { country_code } : {}),
    ...(lang ? { lang } : {}),
    ...(date_range ? { date_range } : {}),
    ...(max_results !== undefined ? { max_results } : {}),
  };

  const response = await fetch(`${LINER_BASE_URL}/${mode}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  const responseData = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    return json(responseData ?? { error: `Liner request failed with HTTP ${response.status}` }, response.status);
  }

  return json(responseData as LinerSearchResponse, 200);
});
