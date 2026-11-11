import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { MarkdownBlocks } from './MarkdownBlocks';
import { parseGuide, UnsupportedMarkdownError } from './parseGuide';

it('renders semantic headings, safe links, nested lists and accessible tables', () => {
  render(<MemoryRouter><MarkdownBlocks source={'## Fees\n\nSee [sign in](/signin), [Contact](https://example.com/x), [email](mailto:info@salsasegura.com).\n\n| Fee | Price |\n| --- | --- |\n| Entry | $10 |\n\n1. **x**\n   - `y`\n\n## Fees'} /></MemoryRouter>);
  expect(screen.getAllByRole('heading', {name:'Fees'}).map(h=>h.id)).toEqual(['fees','fees-1']);
  expect(screen.getByRole('link',{name:'sign in'})).toHaveAttribute('href','/signin');
  expect(screen.getByRole('link',{name:'Contact'})).toHaveAttribute('rel','noopener noreferrer');
  expect(screen.getByRole('link',{name:'Contact'})).toHaveAttribute('target','_blank');
  expect(screen.getByRole('region',{name:'Fees table'})).toHaveAttribute('tabindex','0');
  expect(screen.getByRole('columnheader',{name:'Price'})).toBeInTheDocument();
  expect(screen.getByText('x').tagName).toBe('STRONG');
  expect(screen.getByText('y').tagName).toBe('CODE');
  expect(screen.getByText('y').closest('li')?.parentElement?.closest('li')).toBeTruthy();
});
it.each([
  ['<script>alert(1)</script>','html'], ['![x](/a.png)','image'], ['# H1','heading'],
  ['[x](organizers.md)','link'], ['[x](//evil.example)','link'], ['[x](javascript:alert%281%29)','link'],
  ['> quote','blockquote'], ['```js\nx\n```','code'], ['##### Too deep','heading'],
])('rejects unsupported or unsafe content: %s', (source, kind) => {
  expect(()=>parseGuide(source)).toThrow(UnsupportedMarkdownError);
  try { parseGuide(source); } catch (error) { expect((error as UnsupportedMarkdownError).kind).toBe(kind); }
});
