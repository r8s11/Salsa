import { createElement, Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Token, Tokens } from 'marked';
import { parseGuide, UnsupportedMarkdownError } from './parseGuide';

export function MarkdownBlocks({ source }: { source: string }) {
  const parsed = parseGuide(source);
  let headingIndex = 0;
  let precedingHeading = 'Guide';
  function renderTokens(tokens: Token[]): ReactNode {
    return tokens.map((token, key) => {
      const children = 'tokens' in token && token.tokens ? renderTokens(token.tokens as Token[]) : null;
      switch (token.type) {
        case 'space': return null;
        case 'text': case 'escape': return <Fragment key={key}>{children ?? (token as Tokens.Text).text}</Fragment>;
        case 'paragraph': return <p key={key}>{children}</p>;
        case 'heading': {
          const heading = parsed.headings[headingIndex++];
          precedingHeading = heading.text;
          return createElement(`h${heading.depth}`, {key, id:heading.slug}, children);
        }
        case 'strong': return <strong key={key}>{children}</strong>;
        case 'em': return <em key={key}>{children}</em>;
        case 'codespan': return <code key={key}>{(token as Tokens.Codespan).text}</code>;
        case 'br': return <br key={key} />;
        case 'link': {
          const { href, title } = token as Tokens.Link;
          return href.startsWith('/') ? <Link key={key} to={href} title={title ?? undefined}>{children}</Link>
            : <a key={key} href={href} title={title ?? undefined} {...(href.startsWith('https://') ? {target:'_blank',rel:'noopener noreferrer'} : {})}>{children}</a>;
        }
        case 'list': {
          const list = token as Tokens.List;
          const items = list.items.map((item, index) => <li key={index}>{renderTokens(item.tokens)}</li>);
          return list.ordered ? <ol key={key} start={list.start || 1}>{items}</ol> : <ul key={key}>{items}</ul>;
        }
        case 'table': {
          const table = token as Tokens.Table;
          return <div key={key} className="help-table" role="region" tabIndex={0} aria-label={`${precedingHeading} table`}><table>
            <thead><tr>{table.header.map((cell,index)=><th key={index} scope="col">{renderTokens(cell.tokens)}</th>)}</tr></thead>
            <tbody>{table.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column}>{renderTokens(cell.tokens)}</td>)}</tr>)}</tbody>
          </table></div>;
        }
        default: throw new UnsupportedMarkdownError(token.type, token.raw);
      }
    });
  }
  return <>{renderTokens(parsed.tokens)}</>;
}
