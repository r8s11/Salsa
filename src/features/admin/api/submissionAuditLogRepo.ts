import { supabase } from '../../../lib/supabase';

export const submissionAuditLogRepo = {
  async getAuditLogForSubmission(submissionId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, actor:actor_id(display_name, username)')
      .eq('entity_type', 'event_submission')
      .eq('entity_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};
