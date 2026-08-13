import { useQuery } from '@tanstack/react-query';
import { submissionAuditLogRepo } from './submissionAuditLogRepo';

export function useSubmissionAuditLog(submissionId: string) {
  return useQuery({
    queryKey: ['submissionAuditLog', submissionId],
    queryFn: () => submissionAuditLogRepo.getAuditLogForSubmission(submissionId),
    enabled: !!submissionId
  });
}
