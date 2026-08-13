import { describe, it, expect } from 'vitest';
import { detectDuplicates } from './duplicates';
import { EventSubmission } from './submissions';
import { DatabaseEvent } from '../../events/model/types';

describe('detectDuplicates', () => {
  it('should detect a duplicate based on venue and date', () => {
    const submission = {
      submitted_data: {
        location: 'Havana Club',
        event_date: '2026-08-24T18:00:00Z',
        title: 'Salsa Night',
        host: 'Maria'
      }
    } as EventSubmission;

    const candidate = {
      id: '1',
      title: 'Salsa Night',
      location: 'Havana Club',
      event_date: '2026-08-24T19:00:00Z',
      host: 'Different'
    } as DatabaseEvent;

    const duplicates = detectDuplicates(submission, [candidate]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].signals).toContain('same-venue');
    expect(duplicates[0].signals).toContain('same-date');
    expect(duplicates[0].confidence).toBe('high');
  });
});
