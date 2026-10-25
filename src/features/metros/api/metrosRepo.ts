import { supabase } from "../../../lib/supabase";
import type { ActiveMetro, Metro } from "../model/metro";

interface MetroRow {
  slug: string;
  name: string;
  state_region: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
}

interface ActiveMetroRow extends MetroRow {
  upcoming_event_count: number;
  next_event_at: string;
}

const METRO_COLUMNS = "slug, name, state_region, country_code, latitude, longitude";

function toMetro(row: MetroRow): Metro {
  return {
    slug: row.slug,
    name: row.name,
    stateRegion: row.state_region,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/** Every registered metro, for pickers and label lookups. */
export async function fetchMetros(): Promise<Metro[]> {
  const { data, error } = await supabase.from("metros").select(METRO_COLUMNS).order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MetroRow[]).map(toMetro);
}

/** Metros with approved upcoming events — the discovery surface. */
export async function fetchActiveMetros(): Promise<ActiveMetro[]> {
  const { data, error } = await supabase
    .from("public_active_metros")
    .select(`${METRO_COLUMNS}, upcoming_event_count, next_event_at`)
    .order("upcoming_event_count", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ActiveMetroRow[]).map((row) => ({
    ...toMetro(row),
    upcomingEventCount: row.upcoming_event_count,
    nextEventAt: row.next_event_at,
  }));
}
