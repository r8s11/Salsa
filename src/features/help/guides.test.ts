import { expect, it } from 'vitest';
import { guideBySlug, guidePath, loadGuideSource } from './guides';

it.each(['../secret', '%2e%2e%2fsecret', 'dancers/extra', 'README', '', undefined])('rejects unknown guide %s', (slug) => {
  expect(guideBySlug(slug)).toBeUndefined();
});
it('loads the shared source as user-facing content with product links', async () => {
  expect(guideBySlug('schools')?.audience).toBe('School owners and managers');
  const source = await loadGuideSource('dancers');
  expect(source).toContain('[listing access](/help/listing-access)');
  expect(source).not.toMatch(/^# /m);
  expect(source).not.toContain('improvements.md');
  expect(source).not.toContain('Last checked');
  expect(guidePath('schools', 'maintain-the-weekly-timetable')).toBe('/help/schools#maintain-the-weekly-timetable');
});
