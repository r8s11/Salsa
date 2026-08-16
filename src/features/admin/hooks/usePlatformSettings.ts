import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  type PlatformSettingsUpdate,
} from "../api/platformSettingsRepo";

const platformSettingsKey = ["admin", "platform-settings"] as const;

export function usePlatformSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: platformSettingsKey, queryFn: fetchPlatformSettings });
  const update = useMutation({
    mutationFn: (changes: PlatformSettingsUpdate) => updatePlatformSettings(changes),
    onSuccess: (settings) => queryClient.setQueryData(platformSettingsKey, settings),
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
    update,
  };
}
