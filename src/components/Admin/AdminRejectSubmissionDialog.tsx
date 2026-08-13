import { useState } from 'react';
import './AdminRejectSubmissionDialog.css';

interface AdminRejectSubmissionDialogProps {
  submissionId: string;
  isBusy: boolean;
  onConfirm: (reason: string, message: string, note: string) => void;
  onCancel: () => void;
}

const REASONS = [
  'duplicate',
  'missing_information',
  'invalid_venue',
  'cannot_verify',
  'spam',
  'inappropriate',
  'out_of_scope',
  'other',
] as const;

export default function AdminRejectSubmissionDialog({
  submissionId,
  isBusy,
  onConfirm,
  onCancel,
}: AdminRejectSubmissionDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');

  const confirmDisabled = isBusy || (reason === 'other' && note.trim() === '');

  return (
    <div className="admin-reject-submission-dialog__overlay" onClick={onCancel}>
      <div className="admin-reject-submission-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Reject Submission {submissionId}?</h2>
        
        <label htmlFor="reason">Reason for rejection *</label>
        <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label htmlFor="message">Message to submitter</label>
        <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <p>Shared with the submitter.</p>

        <label htmlFor="note">Internal moderator note</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        <p>Only visible to moderators and admins.</p>

        <button onClick={onCancel}>Cancel</button>
        <button disabled={confirmDisabled} onClick={() => onConfirm(reason, message, note)}>Reject</button>
      </div>
    </div>
  );
}
