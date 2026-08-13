import { describe, it, expect, vi } from 'vitest';
import { submissionAuditLogRepo } from './submissionAuditLogRepo';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}));

describe('submissionAuditLogRepo', () => {
  it('should fetch audit log for submission', async () => {
    await submissionAuditLogRepo.getAuditLogForSubmission('123');
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
  });
});
