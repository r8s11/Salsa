import { describe, it, expect } from 'vitest';
import { findVenueMatch } from './venueMatching';
import { EventSubmission } from './submissions';
import { DatabaseEvent } from '../../events/model/types';

describe('findVenueMatch', () => {
  it('should detect an exact match', () => {
    const submission = { submitted_data: { location: 'Havana Club' } } as EventSubmission;
    const existing = [{ location: 'Havana Club' }] as DatabaseEvent[];
    const match = findVenueMatch(submission, existing);
    expect(match?.match).toBe('exact');
  });

  it('should detect a fuzzy match', () => {
    const submission = { submitted_data: { location: 'Havana Club Salsa' } } as EventSubmission;
    const existing = [{ location: 'Havana Club' }] as DatabaseEvent[];
    const match = findVenueMatch(submission, existing);
    expect(match?.match).toBe('fuzzy');
  });
});
