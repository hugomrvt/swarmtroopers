const playwright = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const html = '<!doctype html><html lang="en"><style>body{margin:20px;font:16px sans-serif}h1,p{margin:20px 0}button{display:block;width:180px;height:42px}</style><main><h1 data-swarmtroopers="type">A real heading</h1><p data-swarmtroopers="type">Original content remains readable.</p><button data-swarmtroopers="frame" id="action">Continue</button></main><aside>Outside the chosen root</aside></html>';

async function run(browser, base, name, test, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'no-preference', javaScriptEnabled: options.javaScriptEnabled !== false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/case.html', route => {
    let body = options.html || html;
    if (options.csp) body = body.replace(/<style>[\s\S]*?<\/style>/, '').replace('</html>', '<script src="/dist/swarmtroopers.core.iife.js"></script></html>');
    return route.fulfill({ contentType: 'text/html', headers: options.csp ? { 'Content-Security-Policy': options.csp } : {}, body });
  });
  try {
    await page.goto(base + '/case.html');
    if (options.load !== false && !options.csp) await page.addScriptTag({ url: base + (options.full ? '/dist/swarmtroopers.iife.js' : '/dist/swarmtroopers.core.iife.js') });
    await test(page);
    assert.deepEqual(errors, [], `${name}: no uncaught errors`);
    console.log(`PASS  ${name}`);
  } finally { await context.close(); }
}

(async () => {
  const server = http.createServer((request, response) => {
    const file = path.resolve(ROOT, '.' + new URL(request.url, 'http://local').pathname);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/plain');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium';
  const browser = await playwright[engine].launch({ channel: engine === 'chromium' ? process.env.PLAYWRIGHT_CHANNEL || undefined : undefined });
  try {
    await run(browser, base, 'renderer failure leaves the host readable and no orphan canvas', async page => {
      const result = await page.evaluate(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args) { return this.classList.contains('swarmtroopers-overlay') ? null : Reflect.apply(get, this, args); };
        const swarmtroopers = SwarmTroopers.create({ root: 'main' });
        const result = { quality: swarmtroopers.quality, pending: document.querySelectorAll('.swarmtroopers-pending').length, canvas: document.querySelectorAll('canvas.swarmtroopers-overlay').length };
        swarmtroopers.destroy(); return result;
      });
      assert.deepEqual(result, { quality: 'off', pending: 0, canvas: 0 });
    });
    await run(browser, base, 'invalid configuration never broadens the target or mutates the host', async page => {
      const results = await page.evaluate(() => {
        const before = document.querySelector('main').outerHTML;
        const cases = [{ root: '#missing', auto: true }, { root: 'main', maxTasks: -1 }, { root: 'main', speed: 0 }, { root: 'main', agents: { max: Infinity } }, { root: 'main', palette: { count: Infinity } }, { root: 'main', quality: 'wrong' }, { root: 'main', selector: '[' }];
        return cases.map(options => { let rejected = false; try { SwarmTroopers.create(options); } catch { rejected = true; } return rejected && before === document.querySelector('main').outerHTML && !document.querySelector('canvas.swarmtroopers-overlay'); });
      });
      assert(results.every(Boolean));
    });
    await run(browser, base, 'invalid JSON shapes fail without uncaught bootstrap errors', async page => {
      const source = await (await page.request.get(base + '/dist/swarmtroopers.core.iife.js')).text();
      for (const value of ['null', '[]', '42', '"text"', '{']) await page.evaluate(({ source, value }) => {
        const script = document.createElement('script'); script.setAttribute('data-swarmtroopers-init', value); script.textContent = source; document.body.append(script);
      }, { source, value });
      assert(await page.evaluate(() => !window.swarmtroopers && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay')));
    });
    await run(browser, base, 'keyboard focus settles hidden controls and their task ancestors', async page => {
      await page.evaluate(() => { document.querySelector('main').innerHTML = '<article data-swarmtroopers="frame"><button data-swarmtroopers="frame" id="action">Continue</button></article>'; window.swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); });
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement.id === 'action' && !document.querySelector('.swarmtroopers-pending') && getComputedStyle(document.activeElement).opacity === '1'));
    });
    await run(browser, base, 'auto mode leaves essential controls and their containers visible', async page => {
      assert(await page.evaluate(() => {
        document.querySelector('main').innerHTML = '<article style="background:beige"><p>A description</p><button id="action">Continue</button></article>';
        const swarmtroopers = SwarmTroopers.create({ root: 'main', auto: true, trigger: 'manual' });
        const visible = !document.querySelector('#action').closest('.swarmtroopers-pending'); swarmtroopers.destroy(); return visible;
      }));
    });
    await run(browser, base, 'throwing tool factories settle their task and the build continues', async page => {
      await page.evaluate(() => { SwarmTroopers.defineTool('broken', () => { throw new Error('expected factory failure'); }); document.querySelector('h1').setAttribute('data-swarmtroopers', 'broken'); window.swarmtroopers = SwarmTroopers.create({ root: 'main', speed: 3, finale: false }); });
      await page.waitForFunction(() => swarmtroopers.stats.done === swarmtroopers.stats.tasks, null, { timeout: 12000 });
      assert(await page.evaluate(() => !document.querySelector('.swarmtroopers-pending')));
    });
    await run(browser, base, 'throwing cancellation cannot interrupt complete destruction or remount', async page => {
      await page.evaluate(() => {
        SwarmTroopers.defineTool('cleanup', function* (c) { c.reveal.begin('inset(0 80% 0 0)'); try { for (;;) yield; } finally { throw new Error('expected cleanup failure'); } });
        document.querySelector('h1').setAttribute('data-swarmtroopers', 'cleanup'); window.swarmtroopers = SwarmTroopers.create({ root: 'main', patience: 100 }); SwarmTroopers.controls(swarmtroopers);
      });
      await page.waitForFunction(() => document.querySelector('h1').style.clipPath);
      assert(await page.evaluate(() => {
        swarmtroopers.destroy(); swarmtroopers.destroy();
        const restored = !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay,.swarmtroopers-controls') && !document.querySelector('h1').style.clipPath;
        const next = SwarmTroopers.create({ root: 'main', quality: 'off' }); next.destroy(); return restored;
      }));
    });
    await run(browser, base, 'renderer callback failure restores the page and resets the loop', async page => {
      await page.evaluate(() => {
        SwarmTroopers.defineTool('bad-mark', function* (c) { c.mark({ kind: 'select', rect() { throw new Error('expected renderer failure'); } }); for (;;) yield; });
        document.querySelector('h1').setAttribute('data-swarmtroopers', 'bad-mark'); window.swarmtroopers = SwarmTroopers.create({ root: 'main', patience: 100 });
      });
      await page.waitForFunction(() => swarmtroopers.destroyed, null, { timeout: 10000 });
      assert(await page.evaluate(() => !swarmtroopers.running && swarmtroopers.raf === 0 && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay')));
    });
    await run(browser, base, 'plugin setup rollback and teardown are isolated', async page => {
      assert(await page.evaluate(() => {
        let cleaned = 0, rejected = false;
        try { SwarmTroopers.create({ root: 'main', plugins: [{ name: 'owned', setup() { return () => { cleaned++; throw new Error('expected teardown failure'); }; } }, { name: 'broken', setup() { throw new Error('expected setup failure'); } }] }); } catch { rejected = true; }
        const next = SwarmTroopers.create({ root: 'main', quality: 'off', plugins: [{ name: 'invalidator', invalidate() { throw new Error('expected invalidation failure'); } }] });
        next.refresh(); next.destroy(); return rejected && cleaned === 1 && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay');
      }));
    });
    await run(browser, base, 'refresh removes disconnected tasks and the current view can complete', async page => {
      await page.evaluate(() => {
        window.swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual', finale: false, speed: 3 });
        for (let i = 0; i < 25; i++) { document.querySelector('main').innerHTML = `<p data-swarmtroopers="type">Replacement ${i}</p>`; swarmtroopers.refresh(); }
        swarmtroopers.start();
      });
      await page.waitForFunction(() => swarmtroopers.finished, null, { timeout: 12000 });
      assert(await page.evaluate(() => swarmtroopers.stats.tasks === 1 && swarmtroopers.stats.done === 1 && swarmtroopers.tasks.every(t => t.el.isConnected)));
    });
    await run(browser, base, 'system motion changes settle pending content without saving a manual choice', async page => {
      await page.evaluate(() => { localStorage.clear(); window.swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => swarmtroopers.quality === 'off');
      assert(await page.evaluate(() => !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay') && localStorage.getItem('swarmtroopers:quality') === null));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => swarmtroopers.quality !== 'off');
      assert(await page.evaluate(() => !document.querySelector('.swarmtroopers-pending')));
      await page.evaluate(() => swarmtroopers.setQuality('light'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.evaluate(() => swarmtroopers.quality), 'light');
    });
    await run(browser, base, 'printing restores clips and hides decorative UI', async page => {
      await page.evaluate(() => { document.querySelector('h1').style.setProperty('clip-path', 'circle(50%)', 'important'); window.swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); SwarmTroopers.controls(swarmtroopers); });
      await page.emulateMedia({ media: 'print' });
      await page.waitForFunction(() => !document.querySelector('.swarmtroopers-pending'));
      assert(await page.evaluate(() => getComputedStyle(document.querySelector('h1')).opacity === '1' && document.querySelector('h1').style.getPropertyPriority('clip-path') === 'important' && getComputedStyle(document.querySelector('canvas.swarmtroopers-overlay')).display === 'none' && getComputedStyle(document.querySelector('.swarmtroopers-controls')).display === 'none'));
    });
    await run(browser, base, 'original inline clip value and priority survive completion and teardown', async page => {
      assert(await page.evaluate(() => { const el = document.querySelector('h1'); el.style.setProperty('clip-path', 'circle(50%)', 'important'); const original = el.style.cssText; const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); swarmtroopers.finish(); swarmtroopers.destroy(); return original === el.style.cssText; }));
    });
    await run(browser, base, 'task and discovery budgets leave overflow content untouched', async page => {
      const result = await page.evaluate(() => {
        document.querySelector('main').innerHTML = Array.from({ length: 5000 }, (_, i) => `<p data-swarmtroopers="type">Row ${i}</p>`).join('');
        let reads = 0; const original = window.getComputedStyle; window.getComputedStyle = (...args) => { reads++; return original(...args); };
        const swarmtroopers = SwarmTroopers.create({ root: 'main', maxTasks: 10, trigger: 'manual' });
        const result = { tasks: swarmtroopers.stats.tasks, pending: document.querySelectorAll('.swarmtroopers-pending').length, reads }; swarmtroopers.destroy(); return result;
      });
      assert.equal(result.tasks, 10); assert.equal(result.pending, 10); assert(result.reads < 100);
    });
    await run(browser, base, 'unsupported shadow and transformed hosts use visible passthrough', async page => {
      assert(await page.evaluate(() => {
        const host = document.createElement('div'); document.body.append(host); const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<section><h1 data-swarmtroopers="type">Shadow content</h1></section>';
        const swarmtroopers = SwarmTroopers.create({ root: shadow.querySelector('section') }); const okay = swarmtroopers.quality === 'off' && getComputedStyle(shadow.querySelector('h1')).opacity === '1' && !document.querySelector('canvas.swarmtroopers-overlay'); swarmtroopers.destroy();
        document.body.style.transform = 'translateY(80px)'; const next = SwarmTroopers.create({ root: 'main' }); const transformed = next.quality === 'off' && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay'); next.destroy(); return okay && transformed;
      }));
    });
    await run(browser, base, 'overlapping instances are refused and independent roots can coexist', async page => {
      assert(await page.evaluate(() => {
        const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); let refused = false;
        try { SwarmTroopers.create({ root: 'body', auto: true }); } catch { refused = true; }
        document.querySelector('aside').innerHTML = '<p data-swarmtroopers=type>Independent region</p>'; const second = SwarmTroopers.create({ root: 'aside', trigger: 'manual' }); swarmtroopers.destroy(); const stillStyled = getComputedStyle(document.querySelector('aside p')).opacity === '0'; second.destroy(); return refused && stillStyled && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay');
      }));
    });
    await run(browser, base, 'the full profile does not decode completion images when finale is disabled', async page => {
      assert.equal(await page.evaluate(() => { let images = 0; const Original = window.Image; window.Image = function (...args) { images++; return new Original(...args); }; const swarmtroopers = SwarmTroopers.create({ root: 'main', finale: false, trigger: 'manual' }); swarmtroopers.destroy(); return images; }), 0);
    }, { full: true });
    await run(browser, base, 'the 0.5.0 ESM finale alias still resolves next to the core renderer', async page => {
      await page.evaluate(async () => {
        const { create } = await import('/dist/swarmtroopers.js'); await import('/dist/finale.js');
        window.swarmtroopers = create({ root: 'main', speed: 3 });
        window.draws = 0; const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (...args) { window.draws++; return Reflect.apply(draw, this, args); };
      });
      await page.waitForFunction(() => window.draws > 0, null, { timeout: 15000 });
    });
    await run(browser, base, 'strict CSP and unavailable constructable styles leave content visible', async page => {
      assert(await page.evaluate(() => {
        window.CSSStyleSheet = function () { throw new Error('expected unavailable CSSOM'); };
        const swarmtroopers = SwarmTroopers.create({ root: 'main' }); const safe = swarmtroopers.quality === 'off' && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay'); swarmtroopers.destroy(); return safe;
      }));
    }, { csp: "default-src 'self'; script-src 'self'; style-src 'none'; img-src 'none'" });
    await run(browser, base, 'refresh discovers additions inside a pending auto container', async page => {
      assert(await page.evaluate(() => {
        document.querySelector('main').innerHTML = '<article style="background:beige"><p>First child</p></article>';
        const swarmtroopers = SwarmTroopers.create({ root: 'main', auto: true, trigger: 'manual' }); const child = document.createElement('p'); child.textContent = 'New child'; document.querySelector('article').append(child); swarmtroopers.refresh();
        const enrolled = swarmtroopers.tasks.some(task => task.el === child); swarmtroopers.destroy(); return enrolled;
      }));
    });
    await run(browser, base, 'refresh retires newly hidden content and keeps zero-task state coherent', async page => {
      assert(await page.evaluate(() => {
        const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); document.querySelector('main').style.display = 'none'; swarmtroopers.refresh(); const empty = swarmtroopers.stats.tasks === 0; swarmtroopers.destroy(); return empty && !document.querySelector('.swarmtroopers-pending');
      }));
    });
    await run(browser, base, 'the full script draws the pixel clap sprite', async page => {
      await page.evaluate(() => {
        window.layerDraws = 0; const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) { if (source.src?.startsWith('data:image/png')) window.layerDraws++; return Reflect.apply(draw, this, [source, ...args]); };
        window.swarmtroopers = SwarmTroopers.create({ root: 'main', speed: 3 });
      });
      await page.waitForFunction(() => layerDraws > 0, null, { timeout: 15000 });
      assert(await page.evaluate(() => swarmtroopers.stats.done === swarmtroopers.stats.tasks && !document.querySelector('.swarmtroopers-pending')));
    }, { full: true });
    await run(browser, base, 'the full inspection-only profile never decodes unused completion images', async page => {
      assert.equal(await page.evaluate(() => { let images = 0; const Original = window.Image; window.Image = function (...args) { images++; return new Original(...args); }; document.querySelector('main').innerHTML = '<p>No annotated work</p>'; const swarmtroopers = SwarmTroopers.create({ root: 'main', inspect: true }); swarmtroopers.destroy(); return images; }), 0);
    }, { full: true });
    await run(browser, base, 'a classic horizontal scrollbar is not mistaken for a transformed document', async page => {
      assert(await page.evaluate(() => {
        // Headless browsers draw overlay scrollbars; a classic one makes innerHeight taller than the layout viewport.
        Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => document.documentElement.clientHeight + 15 });
        const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); const mounted = swarmtroopers.quality !== 'off' && document.querySelectorAll('canvas.swarmtroopers-overlay').length === 1; swarmtroopers.destroy(); return mounted;
      }));
    });
    await run(browser, base, 'auto mode builds inside focus targets and honours forced tools around controls', async page => {
      assert.deepEqual(await page.evaluate(() => {
        document.querySelector('main').innerHTML = '<div id="content" tabindex="-1"><p id="copy">Reached by a skip link</p></div><article id="card" data-swarmtroopers="frame" style="background:beige"><a href="#more">More</a></article><div id="plain" style="background:beige"><a href="#more">More</a></div>';
        const swarmtroopers = SwarmTroopers.create({ root: 'main', auto: true, trigger: 'manual' });
        const tools = Object.fromEntries(swarmtroopers.tasks.map(task => [task.el.id, task.tool])); swarmtroopers.destroy(); return tools;
      }), { copy: 'type', card: 'frame' });
    });
    await run(browser, base, 'a failed renderer mount after Off keeps the instance and its controls', async page => {
      assert.deepEqual(await page.evaluate(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args) { return this.classList.contains('swarmtroopers-overlay') ? null : Reflect.apply(get, this, args); };
        const swarmtroopers = SwarmTroopers.create({ root: 'main', quality: 'off' }); SwarmTroopers.controls(swarmtroopers); swarmtroopers.setQuality('full');
        const result = { destroyed: swarmtroopers.destroyed, quality: swarmtroopers.quality, controls: document.querySelectorAll('.swarmtroopers-controls').length, off: document.querySelector('.swarmtroopers-controls button:nth-of-type(3)').getAttribute('aria-pressed'), canvas: document.querySelectorAll('canvas.swarmtroopers-overlay').length };
        swarmtroopers.destroy(); return result;
      }), { destroyed: false, quality: 'off', controls: 1, off: 'true', canvas: 0 });
    });
    await run(browser, base, 'refresh keeps built content that is only hidden, so showing it again does not rebuild it', async page => {
      assert.deepEqual(await page.evaluate(() => {
        const main = document.querySelector('main'); const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); let dones = 0; swarmtroopers.on('done', () => dones++);
        swarmtroopers.finish(); main.style.display = 'none'; swarmtroopers.refresh(); main.style.display = ''; swarmtroopers.refresh();
        const result = { ...swarmtroopers.stats, dones, pending: document.querySelectorAll('.swarmtroopers-pending').length }; swarmtroopers.destroy(); return result;
      }), { tasks: 3, done: 3, agents: 0, active: 0, dones: 1, pending: 0 });
    });
    await run(browser, base, 'hidden built content does not hold the task budget against new content', async page => {
      assert.deepEqual(await page.evaluate(() => {
        const main = document.querySelector('main'); main.innerHTML = '<div id="old"><p data-swarmtroopers="type">One</p><p data-swarmtroopers="type">Two</p></div>';
        const swarmtroopers = SwarmTroopers.create({ root: 'main', maxTasks: 2, trigger: 'manual' }); swarmtroopers.finish();
        document.querySelector('#old').hidden = true; main.insertAdjacentHTML('beforeend', '<h1 data-swarmtroopers="type" id="next">Next route</h1>'); swarmtroopers.refresh();
        const result = { tasks: swarmtroopers.stats.tasks, next: swarmtroopers.tasks.some(task => task.el.id === 'next' && task.state === 'pending') }; swarmtroopers.destroy(); return result;
      }), { tasks: 1, next: true });
    });
    await run(browser, base, 'a stale pending class from a DOM snapshot never keeps content hidden', async page => {
      assert.deepEqual(await page.evaluate(() => {
        document.querySelector('main').innerHTML = '<h1 data-swarmtroopers="type" class="swarmtroopers-pending">Restored from a snapshot</h1><p class="swarmtroopers-pending">No longer annotated</p><section style="background:beige" class="swarmtroopers-pending"><p>Auto content</p></section>';
        const first = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); first.finish(); const annotated = document.querySelectorAll('.swarmtroopers-pending').length; first.destroy();
        for (const el of document.querySelectorAll('main > *')) el.classList.add('swarmtroopers-pending');
        const second = SwarmTroopers.create({ root: 'main', auto: true, trigger: 'manual' }); const enrolled = second.stats.tasks; second.finish(); const auto = document.querySelectorAll('.swarmtroopers-pending').length; second.destroy();
        return { annotated, enrolled, auto, after: document.querySelectorAll('.swarmtroopers-pending').length };
      }), { annotated: 0, enrolled: 4, auto: 0, after: 0 });
    });
    await run(browser, base, 'annotated discovery reaches late and appended content in a large document', async page => {
      assert.deepEqual(await page.evaluate(() => {
        // A hidden scan region is cut at its root: its content must not spend the budget either.
        const main = document.querySelector('main'); main.innerHTML = '<div><span>Filler</span></div>'.repeat(4000) + '<div hidden><section data-swarmtroopers="scan">' + '<p>Hidden</p>'.repeat(300) + '</section></div><p data-swarmtroopers="type" id="late">Late section</p>';
        let reads = 0; const original = window.getComputedStyle; window.getComputedStyle = (...args) => { reads++; return original(...args); };
        const swarmtroopers = SwarmTroopers.create({ root: 'main', maxTasks: 5, trigger: 'manual' }); const late = swarmtroopers.tasks.some(task => task.el.id === 'late');
        main.insertAdjacentHTML('beforeend', '<p data-swarmtroopers="type" id="appended">Loaded later</p>'); swarmtroopers.refresh();
        const result = { late, appended: swarmtroopers.tasks.some(task => task.el.id === 'appended'), bounded: reads < 100 }; swarmtroopers.destroy(); return result;
      }), { late: true, appended: true, bounded: true });
    });
    await run(browser, base, 'reading order stays unique after refresh pruned earlier tasks', async page => {
      assert.deepEqual(await page.evaluate(() => {
        const swarmtroopers = SwarmTroopers.create({ root: 'main', trigger: 'manual' }); document.querySelector('h1').remove(); swarmtroopers.refresh();
        document.querySelector('main').insertAdjacentHTML('beforeend', '<p data-swarmtroopers="type">Added</p><p data-swarmtroopers="type">Added again</p>'); swarmtroopers.refresh();
        const orders = swarmtroopers.tasks.map(task => task.order); swarmtroopers.destroy(); return { tasks: orders.length, unique: new Set(orders).size };
      }), { tasks: 4, unique: 4 });
    });
    await run(browser, base, 'an explicit quality follows later system motion changes like a reload would', async page => {
      await page.evaluate(() => { localStorage.clear(); window.swarmtroopers = SwarmTroopers.create({ root: 'main', quality: 'full', trigger: 'manual' }); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => swarmtroopers.quality === 'off');
      assert(await page.evaluate(() => !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay') && localStorage.getItem('swarmtroopers:quality') === null));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => swarmtroopers.quality === 'full');
    });
    await run(browser, base, 'the core finale draws the haloed pixel hands, not the old colours', async page => {
      await page.evaluate(() => { window.swarmtroopers = SwarmTroopers.create({ root: 'main', speed: 3, palette: ['#00aa00'] }); });
      await page.waitForFunction(() => swarmtroopers.fin && swarmtroopers.fin.age > 1.2, null, { timeout: 15000 });
      assert.deepEqual(await page.evaluate(() => {
        const canvas = document.querySelector('canvas.swarmtroopers-overlay'); const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const count = (r, g, b) => { let n = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) n++; return n; };
        return { halo: count(217, 221, 228) > 100, blue: count(55, 88, 249), orange: count(255, 120, 79) };
      }), { halo: true, blue: 0, orange: 0 });
    });
    await run(browser, base, 'an unreadable numeric attribute falls back instead of failing the element', async page => {
      await page.evaluate(() => { addEventListener('swarmtroopers-ready', event => window.readyDetail = event.detail); document.body.insertAdjacentHTML('beforeend', '<swarmtroopers-overlay root="main" speed="fast" scale="" quality="Full" trigger="click"></swarmtroopers-overlay>'); });
      await page.waitForFunction(() => document.querySelector('swarmtroopers-overlay').swarmtroopers, null, { timeout: 5000 });
      assert.equal(await page.evaluate(() => document.querySelector('swarmtroopers-overlay').swarmtroopers.stats.tasks), 3);
      assert(await page.evaluate(() => readyDetail === document.querySelector('swarmtroopers-overlay').swarmtroopers), 'the bubbling ready event carries the element instance');
    });
    await run(browser, base, 'a root from another same-realm document uses visible passthrough', async page => {
      assert(await page.evaluate(() => {
        const other = document.implementation.createHTMLDocument('other'); other.body.innerHTML = '<p data-swarmtroopers="type">Elsewhere</p>';
        const swarmtroopers = SwarmTroopers.create({ root: other.body }); const safe = swarmtroopers.quality === 'off' && !document.querySelector('canvas.swarmtroopers-overlay') && !other.querySelector('.swarmtroopers-pending'); swarmtroopers.destroy(); return safe;
      }));
    });
    const preload = fs.readFileSync(path.join(ROOT, 'snippet/preload.html'), 'utf8');
    const preloadHTML = `<!doctype html><html><head>${preload}</head><body><main><h1 data-swarmtroopers-preload>Optional title</h1><div data-swarmtroopers-preload><button>Essential</button></div><p data-swarmtroopers-preload data-swarmtroopers-skip>Skipped</p><section data-swarmtroopers-skip><p data-swarmtroopers-preload>Skipped descendant</p></section></main></body></html>`;
    await run(browser, base, 'preload is explicit, preserves controls and expires without the engine', async page => {
      assert(await page.evaluate(() => getComputedStyle(document.querySelector('h1')).opacity === '0' && getComputedStyle(document.querySelector('button').parentElement).opacity === '1' && [...document.querySelectorAll('[data-swarmtroopers-skip]')].every(el => getComputedStyle(el).opacity === '1')));
      await page.waitForFunction(() => !document.documentElement.classList.contains('swarmtroopers-preload'), null, { timeout: 5000 });
      assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).opacity), '1');
    }, { html: preloadHTML, load: false });
    await run(browser, base, 'preloaded elements are still discovered in auto mode, without a flash', async page => {
      assert.deepEqual(await page.evaluate(() => {
        const title = document.querySelector('h1'); const preloaded = document.documentElement.classList.contains('swarmtroopers-preload') && getComputedStyle(title).opacity === '0';
        const swarmtroopers = SwarmTroopers.create({ root: 'main', auto: true, trigger: 'manual' });
        const result = { preloaded, enrolled: swarmtroopers.tasks.some(task => task.el === title), opacity: getComputedStyle(title).opacity, lifted: !document.documentElement.classList.contains('swarmtroopers-preload') };
        // Once the preload is lifted, a marked element the site itself keeps at opacity 0 is invisible like any other.
        document.querySelector('main').insertAdjacentHTML('beforeend', '<div data-swarmtroopers-preload id="faded" style="opacity:0;background:beige;width:200px;height:60px"></div>'); swarmtroopers.refresh();
        result.faded = swarmtroopers.tasks.some(task => task.el.id === 'faded'); swarmtroopers.destroy(); return result;
      }), { preloaded: true, enrolled: true, opacity: '0', lifted: true, faded: false });
    }, { html: preloadHTML.replace('<h1 data-swarmtroopers-preload>', '<h1 data-swarmtroopers-preload style="transition:opacity .4s">') });
    await run(browser, base, 'preload never hides content without JavaScript', async page => {
      assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).opacity), '1');
    }, { html: preloadHTML, load: false, javaScriptEnabled: false });
    await run(browser, base, 'late script initialization exposes the API before its ready handler', async page => {
      await page.evaluate(() => { window.readyApis = []; addEventListener('swarmtroopers-ready', event => readyApis.push(typeof window.SwarmTroopers.create === 'function' && event.detail === window.swarmtroopers)); });
      const source = await (await page.request.get(base + '/dist/swarmtroopers.core.iife.js')).text();
      await page.evaluate(source => { const script = document.createElement('script'); script.setAttribute('data-swarmtroopers-init', '{"root":"main","quality":"off"}'); script.textContent = source; document.body.append(script); }, source);
      await page.waitForFunction(() => readyApis.length === 1);
      assert(await page.evaluate(() => readyApis.every(Boolean)));
    });
    console.log('All portability regression checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
