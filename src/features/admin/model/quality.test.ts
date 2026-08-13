import { describe, it, expect } from 'vitest';
import { checkSubmissionQuality } from './quality';
import { EventSubmission } from './submissions';

describe('checkSubmissionQuality', () => {
  it('should identify required gaps', () => {
    const submission = {
      submitted_data: { title: '', event_date: null, city: '', event_type: null },
    } as EventSubmission;

    const gaps = checkSubmissionQuality(submission);
    expect(gaps).toContainEqual({ issue: 'title', tier: 'required' });
    expect(gaps).toContainEqual({ issue: 'event_date', tier: 'required' });
    expect(gaps).toContainEqual({ issue: 'city', tier: 'required' });
    expect(gaps).toContainEqual({ issue: 'event_type', tier: 'required' });
  });

  it('should identify recommended gaps', () => {
    const submission = {
      submitted_data: { 
        title: 'Valid', event_date: '2026-08-24', city: 'boston', event_type: 'social',
        location: null, event_time: null, description: null
      },
    } as EventSubmission;

    const gaps = checkSubmissionQuality(submission);
    expect(gaps).toContainEqual({ issue: 'location', tier: 'recommended' });
    expect(gaps).toContainEqual({ issue: 'event_time', tier: 'recommended' });
    expect(gaps).toContainEqual({ issue: 'description', tier: 'recommended' });
  });
});
