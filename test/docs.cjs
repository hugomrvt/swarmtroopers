const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function members(file, name) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === name);
  assert(declaration, `Missing source interface ${name}`);
  return declaration.members.map(member => member.name.getText(ast));
}

(async () => {
  const { pages } = await import(pathToFileURL(path.join(root, 'docs/content.mjs')));
  assert.equal(new Set(pages.map(page => page.slug)).size, pages.length, 'Each documentation route is unique');
  assert(pages.length >= 14, 'Guides and reference pages cover the complete product');
  let checked = 0;
  for (const page of pages) {
    const file = `docs/${page.slug}.html`;
    const html = read(file);
    assert(html.includes('<html lang="en">'), `${file}: English document`);
    assert(html.includes('— Swarm Troopers documentation</title>'), `${file}: Swarm Troopers page identity`);
    assert(html.includes('class="swarmtroopers-brand-word">swarmtroopers</span>'), `${file}: shared Swarm Troopers wordmark`);
    assert(html.includes('aria-label="Swarm Troopers home"'), `${file}: accessible Swarm Troopers home link`);
    assert(html.includes('id="docs-content"'), `${file}: static article is rendered`);
    const title = page.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    assert(html.includes(title), `${file}: actual page title`);
    assert(!/\b(?:TODO|Lorem ipsum)\b/.test(html), `${file}: no placeholder content`);
    const markup = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, '').replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${file}: no duplicate anchor IDs`);
    for (const [, href] of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const url = new URL(href.replaceAll('&amp;', '&'), `https://swarmtroopers.local/${file}`);
      if (url.origin !== 'https://swarmtroopers.local') continue;
      let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      assert(target === root || target.startsWith(root + path.sep), `${file}: local URL stays in the project`);
      assert(fs.existsSync(target), `${file}: missing local resource ${href}`);
      if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      assert(fs.statSync(target).isFile(), `${file}: URL resolves to a file ${href}`);
      if (url.hash && path.extname(target) === '.html') {
        const id = decodeURIComponent(url.hash.slice(1));
        assert(fs.readFileSync(target, 'utf8').includes(`id="${id}"`), `${file}: missing destination anchor ${href}`);
      }
      checked++;
    }
  }
  const installation = pages.find(page => page.slug === 'installation').body;
  for (const identifier of ['swarmtroopers', 'data-swarmtroopers-init', 'window.SwarmTroopers', 'window.swarmtroopers']) {
    assert(installation.includes(identifier), `Installation explains ${identifier}`);
  }
  const overview = pages.find(page => page.slug === 'index').body;
  assert(overview.includes('window.SwarmTroopers') && overview.includes('window.swarmtroopers'), 'First example uses canonical Swarm Troopers globals');
  for (const [slug, file, name] of [
    ['options', 'src/types.ts', 'SwarmTroopersOptions'],
    ['options', 'src/types.ts', 'PaletteSpec'],
    ['controls', 'src/controls.ts', 'ControlsOptions'],
    ['tokens', 'src/plugins/tokens.ts', 'TokensOptions'],
    ['localization', 'src/chat.ts', 'ChatOptions'],
    ['extending', 'src/types.ts', 'SwarmTroopersPlugin'],
    ['extending', 'src/tools.ts', 'ToolContext'],
  ]) {
    const page = pages.find(page => page.slug === slug);
    assert(page, `Reference page exists: ${slug}`);
    for (const member of members(file, name)) assert(page.body.includes(member), `${slug}: documents ${name}.${member}`);
  }
  const landing = read('index.html');
  assert(!landing.includes('class="finale-section"') && !landing.includes('id="show-finale"'), 'Standalone high-five promotion is absent');
  assert(landing.includes('href="docs/"'), 'Landing links to local documentation');
  console.log(`PASS: ${pages.length} static documentation pages, ${checked} local resources/anchors and public option interfaces verified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
