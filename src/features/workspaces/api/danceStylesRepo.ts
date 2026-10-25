import { supabase } from "../../../lib/supabase";

export type DanceStyleOption = { id: string; name: string };

/**
 * Active dance styles for the timetable's style picker. Read straight from
 * `taxonomy_terms`: active terms are publicly readable, whereas the admin
 * taxonomy RPC refuses everyone who is not a platform admin.
 */
export async function fetchActiveDanceStyles(): Promise<DanceStyleOption[]> {
  const { data, error } = await supabase
    .from("taxonomy_terms")
    .select("id, name")
    .eq("category", "dance_style")
    .eq("status", "active")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DanceStyleOption[];
}
