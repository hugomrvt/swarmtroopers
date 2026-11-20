// Browser smoke test: node test/e2e.cjs
// Needs Playwright with Chromium (npx playwright install chromium).
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.resolve(ROOT, '.' + url);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(404);
        res.end();
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

async function openPage(browser, url, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1440, height: 900 }, reducedMotion: options.reducedMotion || 'no-preference' });
  // Keep these interaction tests independent of GitHub availability and rate limits.
  await context.route('https://api.github.com/repos/hugomrvt/swarmtroopers', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { stargazers_count: 17 } }));
  await context.addInitScript(() => {
    window.swarmtroopersLayerDraws = 0;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement && /^data:image\/(webp|svg)/.test(source.src)) window.swarmtroopersLayerDraws++;
      return Reflect.apply(draw, this, [source, ...args]);
    };
  });
  // CI machines report few cores, which would select "light": test the full budget unless asked otherwise.
  if (options.quality !== null) await context.addInitScript((q) => localStorage.setItem('swarmtroopers:quality', q), options.quality || 'full');
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  return { context, page, errors };
}

const state = (page) => page.evaluate(() => {
  const swarmtroopers = window.swarmtroopers;
  return {
    stats: swarmtroopers ? swarmtroopers.stats : null,
    pending: document.querySelectorAll('.swarmtroopers-pending').length,
    clipped: Array.from(document.querySelectorAll('main *')).filter((el) => el.style && /polygon|inset/.test(el.style.clipPath)).length,
    canvas: document.querySelectorAll('canvas.swarmtroopers-overlay').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

async function cpuSample(page, ms) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const a = await read();
  await page.waitForTimeout(ms);
  const b = await read();
  const pct = (k) => (((b[k] - a[k]) / (ms / 1000)) * 100).toFixed(1) + '%';
  return { task: pct('TaskDuration'), script: pct('ScriptDuration'), layout: pct('LayoutDuration'), style: pct('RecalcStyleDuration') };
}

async function buildDemo(browser, base, file, name) {
  const { context, page, errors } = await openPage(browser, `${base}/demo/${file}`);
  await page.waitForFunction(() => window.swarmtroopers && window.swarmtroopers.stats.tasks > 0, null, { timeout: 10000 });
  check(await page.evaluate(() => typeof SwarmTroopers.create === 'function' && typeof SwarmTroopers.SwarmTroopers === 'function'), `${name}: the browser API is exposed`);
  await page.evaluate(() => {
    window.swarmIdentity = { colors: {}, stable: true };
    window.swarmWatch = setInterval(() => {
      for (const agent of window.swarmtroopers.agents) {
        if (agent.lead || !agent.name) continue;
        const previous = window.swarmIdentity.colors[agent.name];
        if (previous && previous !== agent.color) window.swarmIdentity.stable = false;
        window.swarmIdentity.colors[agent.name] = agent.color;
      }
    }, 50);
  });
  const cpu = await cpuSample(page, 2500);
  console.log(`      ${name} main-thread share during the first build: ${JSON.stringify(cpu)}`);
  await page.screenshot({ path: path.join(OUT, `${name}-building.png`) });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 250) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(140);
  }
  await page.waitForFunction(() => window.swarmtroopers.stats.done === window.swarmtroopers.stats.tasks, null, { timeout: 90000 }).catch(() => undefined);
  // The closing high five plays over the page, then clears itself.
  const played = await page.waitForFunction(() => window.swarmtroopers.fin && window.swarmtroopers.fin.age > 1, null, { timeout: 3000 }).then(() => true, () => false);
  await page.screenshot({ path: path.join(OUT, `${name}-finale.png`) });
  check(played, `${name}: the finale plays once the page is built`);
  await page.waitForFunction(() => !window.swarmtroopers.fin, null, { timeout: 6000 }).catch(() => undefined);
  check(await page.evaluate(() => !window.swarmtroopers.fin && window.swarmtroopers.stats.active === 0), `${name}: the finale clears itself and the troopers are gone`);
  const s = await state(page);
  check(s.stats && s.stats.tasks > 20, `${name}: ${s.stats && s.stats.tasks} tasks found`);
  check(s.stats && s.stats.done === s.stats.tasks, `${name}: every task finished (${s.stats && s.stats.done}/${s.stats && s.stats.tasks}, ${s.stats && s.stats.agents} agents)`);
  check(s.pending === 0, `${name}: nothing left hidden`);
  check(s.clipped === 0, `${name}: no clip-path left on the page`);
  check(s.overflow <= 0, `${name}: no horizontal scroll`);
  const identity = await page.evaluate(() => {
    clearInterval(window.swarmWatch);
    return window.swarmIdentity;
  });
  check(identity.stable && new Set(Object.values(identity.colors)).size >= 3, `${name}: named agents keep distinct, stable colors throughout the build`);
  check(errors.length === 0, `${name}: console clean ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-built.png`), fullPage: true });

  // Inspection: hover a finished heading, an agent should come and label it.
  const target = await page.$('h2');
  if (target) {
    await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const box = await target.boundingBox();
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.waitForTimeout(1600);
    const active = await page.evaluate(() => window.swarmtroopers.stats.active);
    check(active >= 1, `${name}: an agent comes to inspect the hovered element`);
    await page.screenshot({ path: path.join(OUT, `${name}-inspect.png`) });
  }
  await context.close();
}

async function landing(browser, base) {
  const { context, page, errors } = await openPage(browser, base);
  await page.locator('#playground').scrollIntoViewIfNeeded();
  for (const scene of ['page', 'tools', 'finale']) {
    await page.locator(`[data-scene="${scene}"]`).click();
    await page.waitForFunction((scene) => document.querySelector('#live-preview').contentWindow?.document.body?.dataset.scene === scene, scene);
    const frame = await (await page.$('#live-preview')).contentFrame();
    await frame.waitForFunction(() => window.swarmtroopers && window.swarmtroopers.stats.tasks > 0);
    check(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), `landing ${scene}: entire scene fits its frame`);
    await frame.waitForFunction(() => window.swarmtroopers.fin && window.swarmtroopers.fin.age >= 1.08, null, { timeout: 35000 });
    check(await frame.evaluate(() => window.swarmtroopers.stats.done === window.swarmtroopers.stats.tasks), `landing ${scene}: natural completion plays the real finale`);
    check(await frame.evaluate(() => window.swarmtroopersLayerDraws > 0), `landing ${scene}: finale draws the supplied artwork layers`);
    await page.screenshot({ path: path.join(OUT, `landing-${scene}-finale.png`) });
    if (scene === 'finale') {
      await frame.locator('body').click({ position: { x: 10, y: 10 } });
      await frame.waitForFunction(() => !window.swarmtroopers.fin);
      check(true, 'landing finale: user input dismisses the celebration');
    } else {
      await frame.waitForFunction(() => !window.swarmtroopers.fin);
    }
    check(await frame.evaluate(() => !document.querySelector('.swarmtroopers-pending')), `landing ${scene}: no hidden content after completion`);
  }
  const previous = await page.locator('#live-preview').getAttribute('src');
  await page.locator('#replay').click();
  check(previous !== await page.locator('#live-preview').getAttribute('src'), 'landing: replay restarts the actual scene');
  await page.locator('[data-scene="url"]').click();
  await page.waitForFunction(() => document.querySelector('#playground iframe')?.getAttribute('src') === 'sites/demo.html');
  check(await page.locator('#playground .file').textContent() === 'sites/demo.html', 'landing: full page tab runs the demo page');
  await page.waitForFunction(() => /running|built/.test(document.querySelector('#run-state').textContent), null, { timeout: 20000 });
  check(true, 'landing: the demo page reports its run to the plan tree');
  await page.locator('[data-scene="page"]').click();
  const back = await page.evaluate(() => ({ src: document.querySelector('#playground iframe').getAttribute('src'), file: document.querySelector('#playground .file').textContent }));
  check(back.src.startsWith('site-demo.html?scene=page') && back.file === 'site-demo.html', `landing: scenes come back after a url run ${JSON.stringify(back)}`);
  await page.locator('[data-install="module"]').click();
  check((await page.locator('#install-code').textContent()).includes('import { create, controls }'), 'landing: module installation example is selectable');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#copy-code').click();
  await page.waitForFunction(() => document.querySelector('#copy-status').textContent.startsWith('Copied.'));
  check(await page.evaluate(async () => await navigator.clipboard.readText() === document.querySelector('#install-code').textContent), 'landing: copy writes the exact installation code');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await page.locator('#copy-code').click();
  await page.waitForFunction(() => document.querySelector('#copy-status').textContent.includes('Code selected'));
  check(await page.evaluate(() => getSelection().toString() === document.querySelector('#install-code').textContent), 'landing: denied clipboard selects the exact code for manual copying');
  check(await page.locator('.finale-section, #show-finale').count() === 0, 'landing: dedicated high-five marketing section is removed');
  check(await page.locator('a[href="docs/"]').count() > 0, 'landing: local documentation is linked');
  check(await page.locator('a[href="https://github.com/hugomrvt/swarmtroopers"]').count() > 0, 'landing: GitHub links point to the product repository');
  check(errors.length === 0, `landing: no page errors ${errors.join(', ')}`);
  await page.screenshot({ path: path.join(OUT, 'landing-desktop.png'), fullPage: true });
  await context.close();

  for (const width of [390, 320]) {
    const { context, page, errors } = await openPage(browser, base, { viewport: { width, height: 844 } });
    await page.locator('#playground').scrollIntoViewIfNeeded();
    await page.locator('[data-scene="page"]').click();
    await page.waitForFunction(() => document.querySelector('#live-preview').contentWindow?.swarmtroopers);
    const frame = await (await page.$('#live-preview')).contentFrame();
    await frame.waitForFunction(() => window.swarmtroopers.stats.done === window.swarmtroopers.stats.tasks, null, { timeout: 35000 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `landing ${width}px: no horizontal overflow`);
    check(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), `landing ${width}px: live scene fits without scrolling`);
    check(errors.length === 0, `landing ${width}px: no page errors`);
    await page.screenshot({ path: path.join(OUT, `landing-${width}.png`), fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openPage(browser, base, { reducedMotion: 'reduce', quality: null });
    await page.locator('[data-scene="finale"]').click();
    await page.waitForFunction(() => document.querySelector('#live-preview').contentWindow?.swarmtroopers);
    const frame = await (await page.$('#live-preview')).contentFrame();
    check(await frame.evaluate(() => !document.querySelector('canvas.swarmtroopers-overlay') && !document.querySelector('.swarmtroopers-pending')), 'landing reduced motion: content visible without canvas');
    await context.close();
  }
}

async function branding(browser, base) {
  let expectedWordmark;
  for (const [file, count] of [['/', 0], ['/demo/index.html', 1243], ['/demo/hugo.html', 1243]]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' });
    let requests = 0;
    await context.route('https://api.github.com/repos/hugomrvt/swarmtroopers', route => {
      requests++;
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { stargazers_count: count } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + file);
    const badge = page.locator('header [data-github-stars]');
    await badge.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('header [data-github-stars]').dataset.state === 'ready');
    check(await badge.locator('[data-github-count]').textContent() === new Intl.NumberFormat('en-US').format(count), `${file}: header displays the actual star count, including zero`);
    check(await badge.getAttribute('href') === 'https://github.com/hugomrvt/swarmtroopers', `${file}: star badge links to the intended repository`);
    const brand = await page.locator('header .swarmtroopers-brand').evaluate(async element => {
      await document.fonts.ready;
      const word = element.querySelector('.swarmtroopers-brand-word');
      return {
        image: new URL(element.querySelector('img').src).pathname,
        text: word.textContent,
        font: getComputedStyle(element).fontFamily,
        width: word.getBoundingClientRect().width,
      };
    });
    expectedWordmark ??= brand;
    check(JSON.stringify(brand) === JSON.stringify(expectedWordmark), `${file}: the same mark, wordmark and loaded typeface appear in the header`);
    check(brand.text === 'swarmtroopers', `${file}: the approved Swarm Troopers wordmark is displayed`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${file}: logo and star badge fit a 320px header`);
    if (file !== '/') {
      await page.waitForFunction(() => window.swarmtroopers);
      check(await page.locator('.swarmtroopers-controls-title img').evaluate(img => img.complete && img.naturalWidth > 0 && img.src.startsWith('data:image/svg+xml')), `${file}: the quality dock embeds the shared mark without a network path`);
    }
    check(requests === 1 && errors.length === 0, `${file}: one GitHub request and no uncaught errors`);
    await page.screenshot({ path: path.join(OUT, `brand-${file.includes('hugo') ? 'portfolio' : file === '/' ? 'home' : 'demo'}-320.png`) });
    await context.close();
  }

  for (const [name, response, expected] of [
    ['missing', { status: 404, json: { message: 'Not Found' } }, 'unavailable'],
    ['rate limited', { status: 403, json: { message: 'API rate limit exceeded' } }, 'unavailable'],
    ['offline', null, 'unavailable'],
    ['invalid count', { json: { stargazers_count: '1243' } }, 'unavailable'],
    ['negative count', { json: { stargazers_count: -1 } }, 'unavailable'],
    ['unsafe count', { json: { stargazers_count: Number.MAX_SAFE_INTEGER + 1 } }, 'unavailable'],
    ['invalid JSON', { contentType: 'application/json', body: '{' }, 'unavailable'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let requests = 0;
    await context.route('https://api.github.com/repos/hugomrvt/swarmtroopers', route => {
      requests++;
      return response ? route.fulfill({ headers: { 'access-control-allow-origin': '*' }, ...response }) : route.abort('internetdisconnected');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(expected => document.querySelector('[data-github-stars]').dataset.state === expected, expected);
    check(await page.locator('[data-github-count]').textContent() === '—', `GitHub ${name}: no invented star count`);
    check(await page.locator('[data-github-link]').evaluateAll(links => links.every(link => link.getAttribute('href').startsWith('https://github.com/hugomrvt/swarmtroopers'))), `GitHub ${name}: repository links still work without the API`);
    check(requests === 1 && errors.length === 0, `GitHub ${name}: one request and no uncaught error`);
    if (name === 'missing') await page.screenshot({ path: path.join(OUT, 'brand-unpublished-390.png') });
    await context.close();
  }
}

async function documentation(browser, base) {
  const { context, page, errors } = await openPage(browser, `${base}/docs/`);
  check(await page.locator('.docs-nav a').count() === 14, 'docs: every guide and reference page is in the navigation');
  check(await page.locator('.docs-nav a[aria-current="page"]').count() === 1, 'docs: current page is identified');
  check(await page.locator('canvas.swarmtroopers-overlay').count() === 0, 'docs: reading is never hidden behind Swarm Troopers animations');
  let searches = 0;
  await context.route('**/docs/search.json', route => { searches++; return route.continue(); });
  await page.locator('#docs-search').fill('setQuality');
  await page.waitForFunction(() => !document.querySelector('#docs-search-results').hidden);
  check(await page.locator('#docs-search-results a').count() > 0, 'docs: full-text search finds an API method');
  const target = await page.locator('#docs-search-results a').first().getAttribute('href');
  await page.locator('#docs-search').press('Enter');
  await page.waitForURL(`${base}/docs/${target}`);
  check(await page.locator('.docs-nav a[aria-current="page"]').getAttribute('href') === target, 'docs: keyboard search opens the selected documentation page');
  await page.locator('#docs-search').fill('swarmtroopers-no-such-option-7349');
  await page.waitForFunction(() => document.querySelector('#docs-search-status').textContent.startsWith('No matching pages'));
  check(await page.locator('#docs-search-results').isHidden(), 'docs: search has an honest empty state');
  await page.locator('#docs-search').fill('quality');
  await page.waitForFunction(() => !document.querySelector('#docs-search-results').hidden);
  await page.locator('#docs-search').press('Escape');
  check(await page.locator('#docs-search').inputValue() === '' && await page.locator('#docs-search-results').isHidden(), 'docs: Escape clears the search');
  check(searches === 2, 'docs: each visited page fetches its search index at most once');
  await page.locator('.docs-nav a[href="installation.html"]').click();
  const block = page.locator('.code-block').first();
  const code = await block.locator('code').textContent();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await block.locator('.copy-code').click();
  await page.waitForFunction(() => document.querySelector('.copy-status').textContent.includes('Code copied'));
  check(await page.evaluate(async expected => await navigator.clipboard.readText() === expected, code), 'docs: copy button writes the exact associated example');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await block.locator('.copy-code').click();
  await page.waitForFunction(() => document.querySelector('.copy-status').textContent.includes('Code selected'));
  check(await page.evaluate(expected => getSelection().toString() === expected, code), 'docs: denied clipboard leaves an exact manual-copy selection');
  await page.locator('.docs-nav a[href="examples.html"]').click();
  const preview = page.locator('iframe[data-doc-example]').first();
  await preview.scrollIntoViewIfNeeded();
  const frame = await (await preview.elementHandle()).contentFrame();
  await frame.waitForFunction(() => window.swarmtroopers && window.swarmtroopers.stats.done === window.swarmtroopers.stats.tasks, null, { timeout: 35000 });
  check(await frame.evaluate(() => window.swarmtroopers.stats.tasks > 0 && !document.querySelector('.swarmtroopers-pending')), 'docs: embedded example runs the actual library to completion');
  const before = await preview.getAttribute('src');
  await page.locator('.example-replay').first().click();
  check(before !== await preview.getAttribute('src'), 'docs: replay restarts the working example');
  check(errors.length === 0, `docs: no page or console errors ${errors.join(', ')}`);
  await page.goto(`${base}/docs/options.html`);
  await page.screenshot({ path: path.join(OUT, 'docs-desktop.png'), fullPage: true });
  await context.close();

  for (const width of [390, 320]) {
    const { context, page, errors } = await openPage(browser, `${base}/docs/options.html`, { viewport: { width, height: 844 }, reducedMotion: 'reduce', quality: null });
    check(!await page.locator('#docs-menu').evaluate(menu => menu.open), `docs ${width}px: mobile navigation starts collapsed`);
    await page.locator('#docs-menu summary').click();
    check(await page.locator('.docs-nav a[href="api.html"]').isVisible(), `docs ${width}px: native menu exposes reference navigation`);
    await page.locator('.docs-nav a[href="api.html"]').click();
    check(await page.locator('.docs-nav a[aria-current="page"]').getAttribute('href') === 'api.html', `docs ${width}px: navigation opens the requested page`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `docs ${width}px: wide code and tables stay inside the page`);
    check(await page.locator('header [data-github-stars]').isVisible(), `docs ${width}px: shared header and GitHub badge remain available`);
    check(errors.length === 0, `docs ${width}px: no page errors`);
    await page.screenshot({ path: path.join(OUT, `docs-${width}.png`), fullPage: true });
    await context.close();
  }

  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noScript.newPage();
  await staticPage.goto(base);
  const fallback = staticPage.locator('noscript iframe');
  check(await fallback.isVisible() && await fallback.evaluate(element => getComputedStyle(element).opacity === '1'), 'landing: static demonstration remains visible without JavaScript');
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/search.json'), 'utf8'));
  for (const route of routes) {
    await staticPage.goto(`${base}/docs/${route.url}`);
    check((await staticPage.locator('#docs-content').textContent()).length > 400 && await staticPage.locator('.docs-nav a').count() === 14, `docs ${route.url}: complete content and navigation work without JavaScript`);
    check(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `docs ${route.url}: static mobile layout has no overflow`);
  }
  await noScript.close();
}

async function scriptInit(browser, base) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.route('**/script-init.html', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><main><h1>Existing HTML</h1></main>
      <script>window.readyEvents=[];addEventListener('swarmtroopers-ready',event=>readyEvents.push(event.detail));</script>
      <script src="/dist/swarmtroopers.iife.js" data-swarmtroopers-init='{"root":"main","auto":true,"quality":"off"}'></script>`,
  }));
  const page = await context.newPage();
  await page.goto(`${base}/script-init.html`);
  check(await page.evaluate(() => window.swarmtroopers instanceof SwarmTroopers.SwarmTroopers && readyEvents.length === 1 && readyEvents[0] === window.swarmtroopers), 'data-swarmtroopers-init: the ready event carries the initialized instance');
  await context.close();
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    await branding(browser, base);
    await scriptInit(browser, base);
    await documentation(browser, base);
    await landing(browser, base);
    await buildDemo(browser, base, 'index.html', 'neutral');
    await buildDemo(browser, base, 'hugo.html', 'hugo');

    // Reduced motion: nothing is hidden, no overlay, the page is the page.
    {
      const { context, page, errors } = await openPage(browser, `${base}/demo/hugo.html`, { reducedMotion: 'reduce', quality: null });
      await page.waitForTimeout(800);
      const s = await state(page);
      check(s.pending === 0 && s.canvas === 0, 'reduced motion: content shown at once, no overlay');
      check(errors.length === 0, 'reduced motion: console clean');
      await context.close();
    }

    // destroy() in the middle of a build restores the page.
    {
      const { context, page } = await openPage(browser, `${base}/demo/hugo.html`);
      await page.waitForFunction(() => window.swarmtroopers && window.swarmtroopers.stats.active > 0, null, { timeout: 10000 });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.swarmtroopers.destroy());
      const s = await state(page);
      check(s.pending === 0 && s.clipped === 0 && s.canvas === 0, 'destroy(): page restored mid-build');
      await context.close();
    }

    // Off switch: everything appears, choice remembered on reload.
    {
      const { context, page } = await openPage(browser, `${base}/demo/hugo.html`, { quality: null });
      await page.waitForFunction(() => window.swarmtroopers && window.swarmtroopers.stats.tasks > 0, null, { timeout: 10000 });
      await page.click('.swarmtroopers-controls button:nth-of-type(3)');
      await page.waitForTimeout(300);
      let s = await state(page);
      check(s.pending === 0 && s.canvas === 0, 'Off switch: everything visible, overlay removed');
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(800);
      s = await state(page);
      check(s.pending === 0 && (await page.evaluate(() => window.swarmtroopers.quality)) === 'off', 'Off switch: remembered after reload');
      await context.close();
    }

    // Phone width.
    {
      const { context, page, errors } = await openPage(browser, `${base}/demo/hugo.html`, { viewport: { width: 390, height: 844 } });
      await page.waitForTimeout(3500);
      const s = await state(page);
      check(s.overflow <= 0, 'phone: no horizontal scroll');
      check(errors.length === 0, 'phone: console clean');
      await page.screenshot({ path: path.join(OUT, 'hugo-phone.png') });
      await context.close();
    }

    for (const file of ['index.html', 'hugo.html']) {
      const { context, page } = await openPage(browser, `${base}/demo/${file}`, { reducedMotion: 'reduce', quality: null });
      await page.waitForFunction(() => window.swarmtroopers);
      await page.evaluate(() => window.previousSwarmTroopers = window.swarmtroopers);
      await page.locator('#demo-replay').click();
      check(await page.evaluate(() => window.previousSwarmTroopers !== window.swarmtroopers && document.querySelectorAll('.swarmtroopers-controls').length === 1 && document.querySelectorAll('canvas.swarmtroopers-overlay').length === 0), `${file}: replay replaces Swarm Troopers, keeps one dock, respects reduced motion`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
