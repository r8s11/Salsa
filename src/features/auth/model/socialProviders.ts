import { useEffect, useState } from "react";
import { supabasePublishableKey, supabaseURL } from "../../../lib/supabase";

export type SocialProvider = "apple" | "google" | "facebook";

export const SOCIAL_PROVIDERS: readonly { id: SocialProvider; label: string }[] = [
  { id: "apple", label: "Apple" },
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
];

const NONE: ReadonlySet<SocialProvider> = new Set();

/**
 * Providers switched on in Supabase Auth, read from its public settings
 * endpoint so enabling one in the dashboard shows its button without a
 * redeploy. Any failure yields none: email sign-in still works.
 */
export async function loadEnabledSocialProviders(signal?: AbortSignal): Promise<ReadonlySet<SocialProvider>> {
  try {
    const response = await fetch(`${supabaseURL}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey },
      signal,
    });
    if (!response.ok) return NONE;
    const { external } = (await response.json()) as { external?: Record<string, unknown> };
    return new Set(SOCIAL_PROVIDERS.map(({ id }) => id).filter((id) => external?.[id] === true));
  } catch {
    return NONE;
  }
}

export function useEnabledSocialProviders(): ReadonlySet<SocialProvider> {
  const [enabled, setEnabled] = useState(NONE);
  useEffect(() => {
    const controller = new AbortController();
    void loadEnabledSocialProviders(controller.signal).then((providers) => {
      if (!controller.signal.aborted) setEnabled(providers);
    });
    return () => controller.abort();
  }, []);
  return enabled;
}
