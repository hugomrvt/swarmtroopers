const playwright = require('playwright');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

(async () => {
  const result = await build({
    stdin: { resolveDir: path.resolve(__dirname, '..'), loader: 'jsx', contents: `
      import React, { StrictMode, useEffect, useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { create, controls } from './dist/swarmtroopers.js';
      window.instances = [];
      function Overlay({ page }) {
        useEffect(() => {
          const swarmtroopers = create({ root: 'main', auto: true, finale: false });
          controls(swarmtroopers); window.instances.push(swarmtroopers);
          return () => swarmtroopers.destroy();
        }, [page]);
        return null;
      }
      function App() {
        const [page, setPage] = useState('a');
        return <><nav><button onClick={() => setPage('a')}>Page A</button><button onClick={() => setPage('b')}>Page B</button></nav>
          <main key={page} data-page={page}><h1 style={{ clipPath: 'circle(50%)' }}>Page {page}</h1><p>Content mounted by React.</p><a href="#details">An essential link</a><section id="details"><p>The second section.</p></section></main>
          <Overlay page={page}/></>;
      }
      const root = createRoot(document.querySelector('#app'));
      root.render(<StrictMode><App/></StrictMode>);
      window.unmount = () => root.unmount();
    ` },
    bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
  });
  const server = http.createServer((request, response) => {
    if (request.url === '/app.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(result.outputFiles[0].text); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html lang="en"><head><title>Swarm Troopers lifecycle fixture</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium';
  const browser = await playwright[engine].launch({ channel: engine === 'chromium' ? process.env.PLAYWRIGHT_CHANNEL || undefined : undefined });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.instances?.length === 2);
    assert(await page.evaluate(() => instances[0].destroyed && !instances[1].destroyed && document.querySelectorAll('canvas.swarmtroopers-overlay').length === 1 && document.querySelectorAll('.swarmtroopers-controls').length === 1));
    console.log('PASS  real React StrictMode setup / cleanup / setup');
    for (const name of ['B', 'A', 'B', 'A']) {
      const before = await page.evaluate(() => instances.length);
      await page.getByRole('button', { name: `Page ${name}`, exact: true }).click();
      await page.waitForFunction(before => instances.length > before, before);
      assert(await page.evaluate(() => instances.filter(instance => !instance.destroyed).length === 1 && document.querySelectorAll('canvas.swarmtroopers-overlay').length === 1 && document.querySelectorAll('.swarmtroopers-controls').length === 1));
    }
    console.log('PASS  repeated React route changes keep one instance and one dock');
    await page.evaluate(() => unmount());
    assert(await page.evaluate(() => instances.every(instance => instance.destroyed) && !document.querySelector('.swarmtroopers-pending,canvas.swarmtroopers-overlay,.swarmtroopers-controls')));
    assert.deepEqual(errors, []);
    console.log('PASS  React unmount restores the host without errors');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
