import { useQuery } from "@tanstack/react-query";
import {
  publicEventSuggestionsEnabled,
  registeredEventSubmissionsEnabled,
} from "../admin/api/platformSettingsRepo";

export function useSubmissionAccess(isAuthenticated: boolean) {
  const query = useQuery({
    queryKey: ["submission-access", isAuthenticated ? "registered" : "public"],
    queryFn: isAuthenticated ? registeredEventSubmissionsEnabled : publicEventSuggestionsEnabled,
  });

  return {
    isLoading: query.isPending,
    canSubmit: query.data === true,
    error: query.error ? query.error.message : null,
  };
}
