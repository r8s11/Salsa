import manifest from '../../content/help/guides.json';

export type GuideSlug = 'dancers' | 'djs' | 'venues' | 'organizers' | 'artists' | 'schools' | 'listing-access';
export interface GuideMeta {
  slug: GuideSlug;
  title: string;
  description: string;
  audience: string;
  lastReviewed: string;
}
export const GUIDES: readonly GuideMeta[] = manifest.guides as GuideMeta[];
export function guideBySlug(slug: string | undefined): GuideMeta | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
export function guidePath(slug?: GuideSlug, anchor?: string): string {
  return `/help${slug ? `/${slug}` : ''}${anchor ? `#${anchor}` : ''}`;
}
const sources = import.meta.glob<string>('/docs/user-guides/{README,dancers,djs,venues,organizers,artists,schools,listing-access}.md', { query: '?raw', import: 'default' });

export async function loadGuideSource(slug: GuideSlug | 'index'): Promise<string> {
  if (slug !== 'index' && !guideBySlug(slug)) throw new Error('Unknown help guide');
  const source = await sources[`/docs/user-guides/${slug === 'index' ? 'README' : slug}.md`]();
  // The repository and app share one document: the page owns its title/date,
  // and repository-relative guide links become product routes at this boundary.
  return source
    .replace(/^# .+\n+/u, '')
    .replace(/ Last checked[^\n]*/gu, '')
    .replace(/^Practical help[^\n]*$/mu, 'Practical help for using the Salsa Segura web app.')
    .replace(/^The \[improvement tracker\][^\n]*\n?/mu, '')
    .replace(/\]\(https:\/\/www\.salsasegura\.com\/?([^)]*)\)/gu, '](/$1)')
    .replace(/\]\(README\.md\)/gu, '](/help)')
    .replace(/^## Choose your guide\n[\s\S]*?(?=^## One account)/mu, '')
    .replace(/\]\((dancers|djs|venues|organizers|artists|schools|listing-access)\.md(#[^)]*)?\)/gu, '](/help/$1$2)');
}
