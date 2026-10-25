import { supabase } from "../../../lib/supabase";

export type LinerSearchMode = "web" | "scholar";
export type LinerDateRange = "past_day" | "past_week" | "past_month" | "past_year";

export interface LinerSearchRequest {
  query: string;
  mode?: LinerSearchMode;
  country_code?: string;
  lang?: string;
  date_range?: LinerDateRange;
  max_results?: number;
}

export interface LinerSearchResult {
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

export interface LinerSearchResponse {
  requestId: string;
  results: LinerSearchResult[];
  totalCount: number;
}

export async function searchLiner(request: LinerSearchRequest): Promise<LinerSearchResponse> {
  const { data, error } = await supabase.functions.invoke<LinerSearchResponse>("liner-search", {
    body: request,
  });

  if (error) {
    throw new Error(`Failed to search with Liner: ${error.message}`);
  }

  if (!data) {
    throw new Error("No response from liner-search function");
  }

  return data;
}
