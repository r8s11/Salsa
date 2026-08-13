import { describe, it, expect, vi } from 'vitest';
import { fetchSubmissions } from './submissionsQuery';
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

describe('fetchSubmissions', () => {
  it('should fetch submissions', async () => {
    const submissions = await fetchSubmissions();
    expect(submissions).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('event_submissions');
  });
});
