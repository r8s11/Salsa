import { supabase } from "../../../lib/supabase";

export async function fetchProfileCount(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
