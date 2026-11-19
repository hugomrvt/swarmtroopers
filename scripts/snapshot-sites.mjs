// Freezes the example sites of try.html into sites/*.html: rendered DOM, no site scripts, CSS inlined,
// asset URLs made absolute, Swarm Troopers injected. Rerun by hand when a snapshot looks stale:
//   PLAYWRIGHT_CHANNEL=chrome node scripts/snapshot-sites.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SITES = [
  ['hn', 'https://news.ycombinator.com'],
  ['react', 'https://react.dev'],
  ['hugo', 'https://hugo.mourlev.at'],
];
const CUT = 2400;

// Reports the run to the embedding page with the playground's protocol, and keeps the visitor here.
const REPORT = `<script>(()=>{const post=(state,extra)=>parent!==window&&parent.postMessage({type:'swarmtroopers-demo',scene:'url',state,...extra},'*');for(const k of['click','submit'])addEventListener(k,e=>{if(k==='submit'||e.target.closest?.('a[href]'))e.preventDefault()},true);addEventListener('swarmtroopers-ready',e=>{const s=e.detail;let begun=false;const begin=()=>{if(begun)return;begun=true;post('building',{tools:{},tasks:s.stats.tasks})};s.on('start',begin);if(s.stats.tasks)begin();s.on('task',({tool})=>{begin();post('task',{tool,done:s.stats.done,tasks:s.stats.tasks})});s.on('done',stats=>{begin();post('done',{stats})})},{once:true})})();</script>`;
// Slow auto-scroll that follows the build; any input hands the page back.
const DRIVER = `<script>(()=>{let on=true,last=0,y=scrollY;const stop=()=>{on=false};for(const k of ['wheel','touchstart','keydown','pointerdown'])addEventListener(k,stop,{once:true,passive:true});const step=t=>{if(!on)return;const dt=last?Math.min(t-last,64):16;last=t;const end=document.documentElement.scrollHeight-innerHeight;if(y>=end-1)return;y=Math.max(y,scrollY);y=Math.min(end,y+dt*0.08);scrollTo({top:y,behavior:'instant'});requestAnimationFrame(step)};addEventListener('swarmtroopers-ready',()=>setTimeout(()=>requestAnimationFrame(step),1400),{once:true})})();</script>`;
const LIBRARY = `<script src="../dist/swarmtroopers.iife.js" data-swarmtroopers-init='{"auto":true,"controls":true,"inspect":true,"maxTasks":120}'></script>`;

const absolute = (css, base) => css.replace(/url\(\s*(['"]?)(?!data:|#)([^'")]+)\1\s*\)/g, (_, q, ref) => {
  try { return `url("${new URL(ref, base).href}")`; } catch { return _; }
});

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await mkdir('sites', { recursive: true });
for (const [name, url] of SITES) {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  // Scroll through once so reveal-on-scroll effects fire before their scripts are dropped.
  for (let y = 0; y < CUT; y += 300) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const { html, sheets } = await page.evaluate((cut) => {
    // Keep the first screens only: the agents build what is in view, so page height is run time.
    const below = [...document.body.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().top + scrollY >= cut && el.parentElement.getBoundingClientRect().top + scrollY < cut && getComputedStyle(el).position !== 'fixed');
    below.forEach((el) => el.remove());
    document.querySelectorAll('[id*="cookie" i], [class*="cookie" i], [aria-label*="cookie" i], [id*="consent" i], [class*="consent" i]').forEach((el) => el.remove());
    const sheets = [];
    for (const link of document.querySelectorAll('link[rel~="stylesheet"]')) {
      const marker = document.createElement('style');
      marker.dataset.href = link.href;
      sheets.push(link.href);
      link.replaceWith(marker);
    }
    document.querySelectorAll('script, noscript, iframe, base, link:not([rel~="icon"]), meta[http-equiv]').forEach((el) => el.remove());
    for (const el of document.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
    for (const el of document.querySelectorAll('img[src], source[src], video[poster], link[href]')) {
      for (const key of ['src', 'poster', 'href']) if (el.hasAttribute(key)) el.setAttribute(key, new URL(el.getAttribute(key), location.href).href);
    }
    for (const el of document.querySelectorAll('[srcset]')) {
      el.setAttribute('srcset', el.getAttribute('srcset').split(',').map((part) => {
        const [ref, ...rest] = part.trim().split(/\s+/);
        return [new URL(ref, location.href).href, ...rest].join(' ');
      }).join(', '));
    }
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.removeAttribute('loading'));
    return { html: document.documentElement.outerHTML, sheets };
  }, CUT);
  let out = html;
  for (const href of sheets) {
    const css = await page.request.get(href).then((r) => (r.ok() ? r.text() : '')).catch(() => '');
    out = out.replace(`<style data-href="${href.replace(/&/g, '&amp;')}"></style>`, () => `<style>${absolute(css, href)}</style>`);
  }
  out = out.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${absolute(css, url)}</style>`)
    .replace(/style="([^"]*url\([^"]*)"/g, (_, css) => `style="${absolute(css.replace(/&quot;/g, '"'), url).replace(/"/g, '&quot;')}"`)
    .replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8"><meta name="robots" content="noindex"><!-- Snapshot of ${url} for the Swarm Troopers try page. -->`)
    .replace(/<\/body>(?![\s\S]*<\/body>)/i, () => `${REPORT}${LIBRARY}${DRIVER}</body>`);
  await writeFile(`sites/${name}.html`, '<!doctype html>\n' + out);
  console.log(name, (out.length / 1024).toFixed(0) + ' KB', sheets.length, 'stylesheets');
}
await browser.close();
