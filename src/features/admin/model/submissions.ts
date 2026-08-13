export type SubmissionStatus = 
  | 'pending' 
  | 'in_review' 
  | 'needs_information' 
  | 'approved' 
  | 'rejected' 
  | 'withdrawn';

export type RejectionReason = 
  | 'duplicate'
  | 'missing_information'
  | 'invalid_venue'
  | 'cannot_verify'
  | 'spam'
  | 'inappropriate'
  | 'out_of_scope'
  | 'other';

export interface EventSubmission {
  id: string;
  submitter_id: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  status: SubmissionStatus;
  submitted_data: Record<string, unknown>;
  edited_data: Record<string, unknown> | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: RejectionReason | null;
  rejection_message: string | null;
  internal_note: string | null;
  duplicate_of_event_id: string | null;
  dismissed_duplicate_ids: string[];
  approved_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DuplicateSignal = 'same-venue' | 'same-date' | 'similar-title' | 'same-organizer';

import { DatabaseEvent } from "../../events/model/types";

export interface DuplicateCandidate {
  event: DatabaseEvent;
  signals: DuplicateSignal[];
  confidence: 'high' | 'medium';
}
