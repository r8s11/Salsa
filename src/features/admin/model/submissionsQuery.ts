import { supabase } from "../../../lib/supabase";
import { EventSubmission, SubmissionStatus } from "./submissions";

export async function fetchSubmissions(filters: { status?: SubmissionStatus } = {}) {
  let query = supabase.from("event_submissions").select("*");

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("submitted_at", { ascending: false });
  if (error) throw error;
  return data as EventSubmission[];
}

export async function updateSubmission(id: string, updates: Partial<EventSubmission>) {
  const { data, error } = await supabase
    .from("event_submissions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as EventSubmission;
}

export async function createSubmission(submission: Omit<EventSubmission, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from("event_submissions")
    .insert(submission)
    .select()
    .single();

  if (error) throw error;
  return data as EventSubmission;
}
