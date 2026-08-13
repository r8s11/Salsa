import { describe, it, expect, vi } from 'vitest';
import { submissionsRepo } from './submissionsRepo';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    }))
  }
}));

describe('submissionsRepo', () => {
  it('should fetch pending submissions', async () => {
    await submissionsRepo.getPendingSubmissions();
    expect(supabase.from).toHaveBeenCalledWith('event_submissions');
  });

  it('should fetch submission by id', async () => {
    await submissionsRepo.getSubmissionById('123');
    expect(supabase.from).toHaveBeenCalledWith('event_submissions');
  });

  it('should update submission', async () => {
    await submissionsRepo.updateSubmission('123', { status: 'approved' });
    expect(supabase.from).toHaveBeenCalledWith('event_submissions');
  });
});
