import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { JSDOM } from 'jsdom';

const markdown = new Marked();
const entityDecoder = JSDOM.fragment('<textarea></textarea>').firstChild;
const instructions = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.opencode/AGENTS.md'];
const maintained = [
  'README.md', ...instructions, 'PRODUCT.md', 'GLOSSARY.md', 'docs/DASHBOARD.md',
  ...['events-and-geography', 'seo-and-itineraries', 'analytics', 'shopify-storefront', 'agent-measurement']
    .map((name) => `docs/operations/${name}.md`),
  'docs/plans/documentation-ci/rd.md', 'docs/plans/documentation-ci/eval.md',
];

function decodeEntities(text) {
  entityDecoder.innerHTML = text.replace(/</g, '&lt;');
  return entityDecoder.value;
}

function inlineText(tokens) {
  return tokens.map((token) => {
    if (token.type === 'html') return '';
    if (token.tokens) return inlineText(token.tokens);
    return token.text ?? (token.type === 'br' ? '\n' : '');
  }).join('');
}

function parseDocument(text) {
  const tokens = markdown.lexer(text);
  const headings = new Set();
  const anchors = new Set();
  const links = [];
  const used = new Set();
  const nextSuffix = new Map();
  const claudeImport = tokens.some((token) => token.type === 'paragraph' && /^@AGENTS\.md[ \t]*$/m.test(token.text));
  markdown.walkTokens(tokens, (token) => {
    if (token.type === 'heading') {
      const title = decodeEntities(inlineText(token.tokens));
      headings.add(title);
      const base = title.toLowerCase()
        .replace(/[\u200d\ufe0e\ufe0f]/g, '')
        .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '')
        .replace(/ /g, '-');
      let slug = base;
      let suffix = nextSuffix.get(base) ?? 0;
      while (used.has(slug)) slug = `${base}-${++suffix}`;
      nextSuffix.set(base, suffix);
      used.add(slug);
      anchors.add(slug);
    }
    if (token.type === 'link' || token.type === 'image') links.push({ href: token.href, type: token.type });
  });
  // Detached fragments neither execute embedded scripts nor load external resources.
  const html = JSDOM.fragment(markdown.parser(tokens));
  for (const element of html.querySelectorAll('[id], a[name]')) {
    if (element.hasAttribute('id')) anchors.add(element.getAttribute('id'));
    if (element.localName === 'a' && element.hasAttribute('name')) anchors.add(element.getAttribute('name'));
  }
  return { text, headings, anchors, links, claudeImport };
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function localDestination(href) {
  const destination = decodeEntities(href);
  if (/^(?:\/|[a-z][a-z\d+.-]*:)/i.test(destination)) return null;
  const hash = destination.indexOf('#');
  const location = hash < 0 ? destination : destination.slice(0, hash);
  const query = location.indexOf('?');
  return {
    pathname: decodeURIComponent(query < 0 ? location : location.slice(0, query)),
    fragment: hash < 0 ? '' : decodeURIComponent(destination.slice(hash + 1)),
  };
}

export function checkDocs({ root = process.cwd(), files, readFile = readFileSync } = {}) {
  const errors = [];
  root = path.resolve(root);
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch (error) {
    return [`${root}: cannot read repository root (${error.code ?? error.message})`];
  }
  const label = (file) => path.relative(root, file).split(path.sep).join('/') || '.';
  function checkedPath(file) {
    if (!isWithin(root, file)) throw new Error('outside repository boundary');
    const real = realpathSync(file);
    if (!isWithin(realRoot, real)) throw new Error('outside repository boundary through symlink');
    return real;
  }
  const documents = new Map();
  function load(file) {
    if (documents.has(file)) return documents.get(file);
    let document;
    try {
      checkedPath(file);
      document = parseDocument(String(readFile(file, 'utf8')).replace(/\r\n/g, '\n'));
    } catch (error) {
      errors.push(`${label(file)}: cannot read Markdown input (${error.code ?? error.message})`);
    }
    documents.set(file, document);
    return document;
  }

  let sources = files;
  if (sources === undefined) {
    sources = [...maintained];
    const guides = path.join(root, 'docs/user-guides');
    try {
      checkedPath(guides);
      const entries = readdirSync(guides).filter((name) => name.endsWith('.md')).sort();
      if (!entries.length) throw new Error('no Markdown guides found');
      sources.push(...entries.map((name) => `docs/user-guides/${name}`));
    } catch (error) {
      errors.push(`docs/user-guides: cannot enumerate required guides (${error.code ?? error.message})`);
    }
  }
  for (const source of [...new Set([...sources, ...instructions])].sort()) {
    const file = path.resolve(root, source);
    const document = load(file);
    if (!document) continue;
    for (const { href } of document.links) {
      try {
        const destination = localDestination(href);
        if (!destination) continue;
        const target = destination.pathname ? path.resolve(path.dirname(file), destination.pathname) : file;
        checkedPath(target);
        const stat = statSync(target);
        if (!stat.isFile() && !stat.isDirectory()) throw new Error('target is not a file or directory');
        if (destination.fragment && /\.md$/i.test(target)) {
          const targetDocument = load(target);
          if (!targetDocument) throw new Error('cannot read fragment target');
          if (!targetDocument.anchors.has(destination.fragment)) throw new Error(`missing heading fragment #${destination.fragment}`);
        }
      } catch (error) {
        errors.push(`${label(file)}: ${JSON.stringify(href)}: ${error.code ?? error.message}`);
      }
    }
  }

  const canonical = path.join(root, 'AGENTS.md');
  const claude = load(path.join(root, 'CLAUDE.md'));
  if (claude && !claude.claudeImport) errors.push('CLAUDE.md: missing canonical @AGENTS.md import');
  for (const adapter of instructions.slice(2)) {
    const file = path.join(root, adapter);
    const document = load(file);
    if (!document) continue;
    const directsToCanonical = document.links.some(({ href, type }) => {
      if (type !== 'link') return false;
      try {
        const destination = localDestination(href);
        return destination && destination.pathname
          && path.resolve(path.dirname(file), destination.pathname) === canonical;
      } catch {
        return false;
      }
    });
    if (!directsToCanonical) errors.push(`${adapter}: missing link to repository-root AGENTS.md`);
  }

  const baselineFile = path.join(root, 'scripts/docs-instructions.json');
  let baseline;
  try {
    checkedPath(baselineFile);
    baseline = JSON.parse(String(readFile(baselineFile, 'utf8')));
    if (!Array.isArray(baseline.requiredHeadings) || !baseline.requiredHeadings.length
      || baseline.requiredHeadings.some((heading) => typeof heading !== 'string' || !heading.trim())
      || !Array.isArray(baseline.blocks) || !baseline.blocks.length
      || new Set(baseline.blocks.map((block) => block?.name)).size !== baseline.blocks.length
      || baseline.blocks.some((block) => !block || typeof block.name !== 'string'
        || typeof block.start !== 'string' || !block.start.trim()
        || typeof block.end !== 'string' || !block.end.trim() || block.start === block.end
        || typeof block.sha256 !== 'string' || !/^[\da-f]{64}$/i.test(block.sha256))) {
      throw new Error('invalid requiredHeadings or protected blocks schema');
    }
  } catch (error) {
    errors.push(`scripts/docs-instructions.json: cannot read instruction baseline (${error.code ?? error.message})`);
    baseline = undefined;
  }
  const agents = load(canonical);
  if (baseline && agents) {
    for (const heading of baseline.requiredHeadings) {
      if (!agents.headings.has(heading)) errors.push(`AGENTS.md: missing required heading ${JSON.stringify(heading)}`);
    }
    for (const block of baseline.blocks) {
      const starts = agents.text.split(block.start).length - 1;
      const ends = agents.text.split(block.end).length - 1;
      if (starts !== 1 || ends !== 1) {
        errors.push(`AGENTS.md: protected ${block.name} block requires exactly one start/end marker (found ${starts}/${ends})`);
        continue;
      }
      const start = agents.text.indexOf(block.start);
      const end = agents.text.indexOf(block.end);
      if (end < start + block.start.length || !agents.text.slice(start + block.start.length, end).trim()) {
        errors.push(`AGENTS.md: protected ${block.name} block is empty or has reversed markers`);
        continue;
      }
      const content = agents.text.slice(start, end + block.end.length);
      const hash = createHash('sha256').update(content).digest('hex');
      if (hash !== block.sha256.toLowerCase()) errors.push(`AGENTS.md: protected ${block.name} block differs from reviewed SHA-256 baseline`);
    }
  }
  return errors.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkDocs();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Documentation checks passed.');
  }
}
