import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pages } from '../docs/content.mjs';

const root = new URL('../', import.meta.url);
const directory = new URL('docs/', root);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const groups = ['Getting started', 'Guides', 'Reference'];
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'" })[key]).replace(/\s+/g, ' ').trim();

assert(Array.isArray(pages) && pages.length > 0, 'Documentation needs at least one page.');
const slugs = new Set();
for (const page of pages) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug), `Unsafe documentation slug: ${page.slug}`);
  assert(!slugs.has(page.slug), `Duplicate documentation slug: ${page.slug}`);
  slugs.add(page.slug);
  for (const key of ['title', 'description', 'body']) assert(typeof page[key] === 'string' && page[key].trim(), `Missing ${key}: ${page.slug}`);
  assert(groups.includes(page.group), `Unknown navigation group: ${page.group}`);
  const structure = page.body.replace(/<pre\b[\s\S]*?<\/pre>/g, '').replace(/<code\b[\s\S]*?<\/code>/g, '');
  const ids = [...structure.matchAll(/\bid=(["'])([^"']+)\1/g)].map((match) => match[2]);
  assert(new Set(ids).size === ids.length, `Duplicate content IDs: ${page.slug}`);
  for (const heading of page.body.matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g)) {
    assert(/\bid=(["'])[^"']+\1/.test(heading[2]), `Heading without an ID: ${page.slug}: ${plain(heading[3])}`);
  }
}
assert(slugs.has('index'), 'The documentation needs an overview page.');

function headings(body) {
  return [...body.matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g)].map((match) => ({
    level: Number(match[1]),
    id: match[2].match(/\bid=(["'])([^"']+)\1/)[2],
    title: plain(match[3]),
  }));
}

function enhance(body) {
  return body
    .replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (_, attributes, content) => {
      const language = attributes.match(/\bdata-language=(["'])([^"']+)\1/)?.[2] || 'Code';
      const title = ({ js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', html: 'HTML', css: 'CSS', json: 'JSON', sh: 'Terminal', bash: 'Terminal', jsx: 'JSX', vue: 'Vue', svelte: 'Svelte', astro: 'Astro' })[language] || language;
      return `<div class="code-block"><div class="code-heading"><span>${escape(title.toLowerCase())}</span><button class="copy-code" type="button" aria-label="Copy ${escape(title)} example"><span>copy</span></button></div><pre${attributes} tabindex="0">${content}</pre><p class="copy-status" role="status" aria-live="polite"></p></div>`;
    })
    .replace(/<table\b/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="Reference table"><table')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<iframe\b([^>]*\bdata-doc-example\b[^>]*)>([\s\S]*?)<\/iframe>/g, (_, attributes, content) => `<div class="docs-example"><div class="example-heading"><span><i aria-hidden="true"></i> live swarmtroopers example</span><button class="example-replay" type="button"><span aria-hidden="true">↻</span> replay</button></div><iframe${attributes}>${content}</iframe></div>`)
    .replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attributes, content) => {
      const id = attributes.match(/\bid=(["'])([^"']+)\1/)[2];
      return `<h${level}${attributes}><a class="heading-anchor" href="#${escape(id)}" aria-label="Link to section: ${escape(plain(content))}">${'#'.repeat(level)}</a>${content}</h${level}>`;
    });
}

const logo = `<a class="swarmtroopers-brand" href="../" aria-label="Swarm Troopers home"><img src="../assets/swarmtroopers-mark-sm.svg" width="24" height="24" alt=""><span class="swarmtroopers-brand-word">swarmtroopers</span></a>`;
const badge = `<a class="swarmtroopers-github" data-github-stars href="https://github.com/hugomrvt/swarmtroopers" data-github-link data-state="pending" aria-label="Swarm Troopers on GitHub: star count unavailable" title="Swarm Troopers on GitHub" target="_blank" rel="noopener"><span>GitHub</span><svg class="swarmtroopers-github-star" viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.5 2.2 4.6 5.1.7-3.7 3.6.9 5.1-4.5-2.4-4.5 2.4.9-5.1L2.7 7.8l5.1-.7L10 2.5Z"/></svg><span data-github-count>—</span></a>`;

function navigation(current) {
  return groups.map((group) => `<section class="nav-group"><h2>${escape(group)}</h2><ul>${pages.filter((page) => page.group === group).map((page) => `<li><a href="${page.slug}.html"${page.slug === current ? ' aria-current="page"' : ''}>${escape(page.title)}</a></li>`).join('')}</ul></section>`).join('');
}

function template(page, index) {
  const sectionHeadings = headings(page.body);
  const previous = pages[index - 1];
  const next = pages[index + 1];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="${escape(page.description)}">
  <meta name="theme-color" content="#0D0E11">
  <title>${escape(page.title)} — Swarm Troopers documentation</title>
  <link rel="icon" type="image/svg+xml" href="../assets/swarmtroopers-mark-sm.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@300..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../brand.css">
  <link rel="stylesheet" href="docs.css">
  <script src="../brand.js" defer></script>
  <script src="docs.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#docs-content">Skip to documentation</a>
  <header class="docs-header"><div class="docs-header-inner"><div class="header-brand">${logo}<span class="header-divider" aria-hidden="true"></span><a class="docs-home" href="index.html">docs</a></div><div class="docs-search" role="search"><label class="visually-hidden" for="docs-search">Search documentation</label><div class="search-input"><span class="search-prompt" aria-hidden="true">›</span><input id="docs-search" type="search" placeholder="search the docs" autocomplete="off" aria-controls="docs-search-results" aria-keyshortcuts="Meta+K Control+K"><kbd aria-hidden="true">⌘K</kbd></div><div class="search-panel"><p id="docs-search-status" role="status" aria-live="polite"></p><ol id="docs-search-results" hidden aria-label="Search results"></ol></div></div><span class="docs-version">v${escape(version)}</span><nav aria-label="Site navigation"><a href="../">overview</a><a href="../demo/index.html">playground <span aria-hidden="true">↗</span></a><a href="../try.html">try <span aria-hidden="true">↗</span></a></nav>${badge}</div></header>
  <div class="docs-layout">
    <aside class="docs-sidebar" aria-label="Documentation navigation">
      <details id="docs-menu" open><summary>browse documentation <span aria-hidden="true">▸</span></summary><nav class="docs-nav" aria-label="Documentation pages">${navigation(page.slug)}</nav></details>
      <a class="sidebar-playground" href="../demo/index.html"><img src="../assets/swarmtroopers-mark-sm.svg" alt="" width="20" height="20"><span>Less reading. More playing.<small>Open the full-page demo ↗</small></span></a>
    </aside>
    <main class="docs-main"><article id="docs-content" tabindex="-1"><header class="article-header"><p class="article-eyebrow">docs <span>/</span> ${escape(page.group.toLowerCase())} <span>/</span> ${escape(page.slug)}</p><h1>${escape(page.title)}</h1><p class="article-description">${escape(page.description)}</p></header><div class="doc-content">${enhance(page.body)}</div></article><nav class="docs-pager" aria-label="Documentation pagination">${previous ? `<a class="pager-previous" href="${previous.slug}.html"><span>← previous</span><strong>${escape(previous.title)}</strong></a>` : '<span></span>'}${next ? `<a class="pager-next" href="${next.slug}.html"><span>next →</span><strong>${escape(next.title)}</strong></a>` : '<span></span>'}</nav><footer class="docs-footer"><span>Small team. Thoughtful details.</span><a href="../">back to swarmtroopers <span aria-hidden="true">↗</span></a></footer></main>
    <aside class="docs-toc"><nav aria-label="On this page"><p>on this page</p><ul>${sectionHeadings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escape(heading.id)}">${escape(heading.title)}</a></li>`).join('')}</ul></nav><div class="toc-note"><span class="toc-state"><span aria-hidden="true">✓</span>html first</span><p>Your HTML stays the source of truth.</p></div></aside>
  </div>
</body>
</html>
`;
}

await mkdir(directory, { recursive: true });
await Promise.all(pages.map((page, index) => writeFile(new URL(`${page.slug}.html`, directory), template(page, index))));
await writeFile(new URL('search.json', directory), JSON.stringify(pages.map((page) => ({ title: page.title, description: page.description, url: `${page.slug}.html`, headings: headings(page.body).map((heading) => heading.title), text: plain(page.body) }))) + '\n');
console.log(`Built ${pages.length} static documentation pages and their search index.`);
