import { marked, type Token, type Tokens } from 'marked';
import { headingSlugger } from '../slug';

export class UnsupportedMarkdownError extends Error {
  readonly kind: string;
  constructor(kind: string, detail: string) {
    super(`Unsupported guide ${kind}: ${detail}`);
    this.name = 'UnsupportedMarkdownError';
    this.kind = kind;
  }
}
export interface GuideHeading { depth: 2 | 3 | 4; text: string; slug: string }
const supported = new Set(['space', 'heading', 'paragraph', 'text', 'escape', 'strong', 'em', 'codespan', 'link', 'list', 'list_item', 'table', 'br']);
export function parseGuide(source: string): { tokens: Token[]; headings: GuideHeading[] } {
  const tokens = marked.lexer(source);
  const headings: GuideHeading[] = [];
  const slug = headingSlugger();
  marked.walkTokens(tokens, (token) => {
    if (!supported.has(token.type)) throw new UnsupportedMarkdownError(token.type, token.raw);
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading;
      if (heading.depth < 2 || heading.depth > 4) throw new UnsupportedMarkdownError('heading', heading.text);
      headings.push({ depth: heading.depth as 2 | 3 | 4, text: heading.text.replace(/[`*_]/g, ''), slug: slug(heading.text) });
    }
    if (token.type === 'list_item' && (token as Tokens.ListItem).task) throw new UnsupportedMarkdownError('task', token.raw);
    if (token.type === 'link') {
      const href = (token as Tokens.Link).href;
      // eslint-disable-next-line no-control-regex -- rejecting control characters in links is the sanitisation
      if (/[\s\\\u0000-\u001f\u007f]/u.test(href) || !/^(?:\/(?!\/)|https:\/\/[^/]|mailto:|#)/u.test(href)) {
        throw new UnsupportedMarkdownError('link', href);
      }
    }
  });
  return { tokens, headings };
}
