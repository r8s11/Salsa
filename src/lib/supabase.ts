import { createClient } from "@supabase/supabase-js";

// Get environment variables
export const supabaseURL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://placeholder-project.supabase.co";
const supabaseDefaultKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "placeholder-anon-key";

// Create and export Supabase client
export const supabase = createClient(supabaseURL, supabaseDefaultKey);
