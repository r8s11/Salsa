import { supabase } from "../../../lib/supabase";
import type { PlatformSettings } from "../model/platformSettings";

export type PlatformSettingsUpdate = Partial<
  Pick<
    PlatformSettings,
    | "platform_name"
    | "public_site_url"
    | "support_email"
    | "default_city"
    | "default_event_duration_minutes"
    | "allow_public_event_suggestions"
    | "allow_registered_user_submissions"
  >
>;

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("singleton", true)
    .single();

  if (error) throw new Error(`Failed to load platform settings: ${error.message}`);
  return data as PlatformSettings;
}

export async function updatePlatformSettings(
  update: PlatformSettingsUpdate
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .update(update)
    .eq("singleton", true)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to save platform settings: ${error.message}`);
  return data as PlatformSettings;
}

export async function publicEventSuggestionsEnabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc("public_event_suggestions_enabled");
  if (error) throw new Error(`Failed to check submission access: ${error.message}`);
  return data === true;
}

export async function registeredEventSubmissionsEnabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc("registered_event_submissions_enabled");
  if (error) throw new Error(`Failed to check submission access: ${error.message}`);
  return data === true;
}
