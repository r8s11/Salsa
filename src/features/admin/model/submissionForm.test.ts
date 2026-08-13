import { describe, it, expect } from 'vitest';
import { getEffectiveEventData } from './submissionForm';
import { EventSubmission } from './submissions';

describe('getEffectiveEventData', () => {
  it('should return submitted data when no edits exist', () => {
    const submission = {
      submitted_data: { title: 'Test Event' },
      edited_data: null,
    } as EventSubmission;

    expect(getEffectiveEventData(submission)).toEqual({ title: 'Test Event' });
  });

  it('should merge edits when they exist', () => {
    const submission = {
      submitted_data: { title: 'Test Event', location: 'Old Venue' },
      edited_data: { location: 'New Venue' },
    } as EventSubmission;

    expect(getEffectiveEventData(submission)).toEqual({ title: 'Test Event', location: 'New Venue' });
  });
});
