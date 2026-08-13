import { supabase } from '../../../lib/supabase';
import { Database } from '../../../types/supabase';

type EventSubmission = Database['public']['Tables']['event_submissions']['Row'];

export interface SubmissionUpdate {
  status?: EventSubmission['status'];
  edited_data?: Record<string, any>;
  rejection_reason?: EventSubmission['rejection_reason'];
  rejection_message?: string;
  internal_note?: string;
  duplicate_of_event_id?: string | null;
  approved_event_id?: string | null;
}

export const submissionsRepo = {
  async getPendingSubmissions() {
    const { data, error } = await supabase
      .from('event_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getSubmissionById(id: string) {
    const { data, error } = await supabase
      .from('event_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateSubmission(id: string, update: SubmissionUpdate) {
    const { data, error } = await supabase
      .from('event_submissions')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
