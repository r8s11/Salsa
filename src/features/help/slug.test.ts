import { describe, expect, it } from 'vitest';
import { headingSlugger } from './slug';

describe('guide heading anchors', () => {
  it('normalizes punctuation and code and disambiguates repeated headings', () => {
    const slug = headingSlugger();
    expect(slug('Create an account or sign in')).toBe('create-an-account-or-sign-in');
    expect(slug('Important: drafts in the current Host editor')).toBe('important-drafts-in-the-current-host-editor');
    expect(slug('The `/host` desk')).toBe('the-host-desk');
    expect(slug('Troubleshooting')).toBe('troubleshooting');
    expect(slug('Troubleshooting')).toBe('troubleshooting-1');
    expect(headingSlugger()('Troubleshooting')).toBe('troubleshooting');
  });
  it('avoids collisions with headings that already contain a numeric suffix', () => {
    const slug = headingSlugger();
    expect(slug('Title')).toBe('title');
    expect(slug('Title-1')).toBe('title-1');
    expect(slug('Title')).toBe('title-2');
  });
});
