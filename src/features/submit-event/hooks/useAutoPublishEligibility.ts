import { useQuery } from "@tanstack/react-query";
import {
  fetchMyAutoPublishBlockReason,
  type AutoPublishBlockReason,
} from "../../admin/api/submissionsRepo";

/**
 * Whether the signed-in caller's next submission publishes straight away.
 * Only a hint for labels: the publish RPC re-checks on submit.
 */
export function useAutoPublishEligibility(isAuthenticated: boolean): {
  willPublish: boolean;
  blockReason: AutoPublishBlockReason | null;
} {
  const query = useQuery({
    queryKey: ["auto-publish-eligibility"],
    queryFn: fetchMyAutoPublishBlockReason,
    enabled: isAuthenticated,
  });
  const known = isAuthenticated && query.isSuccess;
  return {
    willPublish: known && query.data === null,
    blockReason: known ? query.data : null,
  };
}
