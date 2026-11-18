// GET /api/try?url=https://stripe.com
// Fetches one of the example pages in SITES, injects Swarm Troopers and a slow auto-scroll, and serves it sandboxed.
// The response is always sandboxed (opaque origin, no forms, no top navigation), so a proxied page
// cannot read this site's storage, submit credentials anywhere or navigate the visitor away.
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const CDN = 'https://unpkg.com/swarmtroopers@0.4.1/dist/swarmtroopers.iife.js';
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 9000;
// Keep in sync with TRY_SITES in try-run.js.
const SITES = new Set(['https://en.wikipedia.org/wiki/Swarm_behaviour', 'https://stripe.com', 'https://react.dev', 'https://tailwindcss.com', 'https://news.ycombinator.com', 'https://hugo.mourlev.at']);

const blocked = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]]) blocked.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) blocked.addSubnet(net, bits, 'ipv6');

// ponytail: resolve-then-fetch leaves a DNS-rebinding window; acceptable on Vercel (no private network to reach).
async function assertPublic(url) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UserError('Only http and https addresses work.');
  if (url.username || url.password) throw new UserError('Addresses with credentials are not accepted.');
  if (url.port && !['80', '443'].includes(url.port)) throw new UserError('Only the default web ports work.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new UserError('That address is not public.');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => { throw new UserError('That domain does not resolve.'); });
  for (const { address, family } of addresses) {
    if (blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')) throw new UserError('That address is not public.');
  }
}

class UserError extends Error {}

async function fetchPage(start) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; swarmtroopers-demo/0.4.1; +https://swarmtroopers.mrvt.app/try.html)', accept: 'text/html,application/xhtml+xml' },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url);
      continue;
    }
    if (!response.ok) throw new UserError(`The site answered ${response.status}.`);
    if (!/text\/html|application\/xhtml/.test(response.headers.get('content-type') || '')) throw new UserError('That address is not an HTML page.');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) throw new UserError('That page is too large for the demo.');
    const html = await response.text();
    if (html.length > MAX_BYTES) throw new UserError('That page is too large for the demo.');
    return { url, html };
  }
  throw new UserError('Too many redirects.');
}

const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Slow scroll that follows the build; any deliberate input hands control back to the visitor.
const DRIVER = `<script>(()=>{let on=true,last=0,y=scrollY;const stop=()=>{on=false};for(const k of ['wheel','touchstart','keydown','pointerdown'])addEventListener(k,stop,{once:true,passive:true});const step=t=>{if(!on)return;const dt=last?Math.min(t-last,64):16;last=t;const end=document.documentElement.scrollHeight-innerHeight;if(y>=end-1)return;y=Math.max(y,scrollY);y=Math.min(end,y+dt*0.08);scrollTo({top:y,behavior:'instant'});requestAnimationFrame(step)};addEventListener('swarmtroopers-ready',()=>setTimeout(()=>requestAnimationFrame(step),1400),{once:true})})();</script>`;

// Runs before the site's own scripts. The sandbox has no storage, cookies or same-URL history, and most
// app frameworks crash on the first SecurityError; in-memory stand-ins let them render.
const SHIM = `<script>(()=>{const mem=()=>{const m=new Map;return{get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>{m.set(String(k),String(v))},removeItem:k=>{m.delete(String(k))},clear:()=>m.clear()}};for(const k of['localStorage','sessionStorage'])try{Object.defineProperty(window,k,{value:mem(),configurable:true})}catch{}let jar=[];try{Object.defineProperty(Document.prototype,'cookie',{configurable:true,get:()=>jar.join('; '),set:v=>{const pair=String(v).split(';')[0].trim();const name=pair.split('=')[0];jar=jar.filter(c=>c.split('=')[0]!==name);if(pair)jar.push(pair)}})}catch{}try{const none=async()=>undefined,cache={match:none,matchAll:async()=>[],add:none,addAll:none,put:none,delete:async()=>false,keys:async()=>[]};Object.defineProperty(window,'caches',{configurable:true,value:{open:async()=>cache,match:none,has:async()=>false,delete:async()=>false,keys:async()=>[]}})}catch{}for(const k of['pushState','replaceState']){const f=history[k];history[k]=function(s,t,u){try{return f.call(this,s,t,u)}catch{return f.call(this,s,t)}}}})();</script>`;

// Same messages as site-demo.html, so try.html and the landing playground can show the run.
// The frame has an opaque origin, so it posts to '*'; the payload is only counts.
// 'left' fires when the page's own scripts navigate it away, so the host can rebuild it without them.
// Links do nothing here: the sandbox would leave the proxy for a page that refuses to be framed.
const REPORT = `<script>(()=>{const post=(state,extra)=>parent!==window&&parent.postMessage({type:'swarmtroopers-demo',scene:'url',state,...extra},'*');addEventListener('pagehide',()=>post('left'));addEventListener('click',e=>{if(e.target.closest&&e.target.closest('a[href]'))e.preventDefault()},true);addEventListener('swarmtroopers-ready',e=>{const s=e.detail;let begun=false;const begin=()=>{if(begun)return;begun=true;post('building',{tools:{},tasks:s.stats.tasks})};s.on('start',begin);if(s.stats.tasks)begin();s.on('task',({tool})=>{begin();post('task',{tool,done:s.stats.done,tasks:s.stats.tasks})});s.on('done',stats=>{begin();post('done',{stats})})},{once:true})})();</script>`;

function inject(html, url, scripts) {
  // ponytail: regex strip is enough for a sandboxed demo; it only runs when the page navigated itself away.
  if (!scripts) html = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<noscript\b[^>]*>|<\/noscript\s*>/gi, '');
  const head = `<base href="${escapeAttr(url.href)}"><meta name="referrer" content="no-referrer">${SHIM}`;
  const tail = `${REPORT}<script src="${CDN}" data-swarmtroopers-init='{"auto":true,"controls":true,"inspect":true}'></script>${DRIVER}`;
  let out = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, '');
  out = /<head\b[^>]*>/i.test(out) ? out.replace(/<head\b[^>]*>/i, (m) => m + head) : head + out;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, tail + '</body>') : out + tail;
  return out;
}

function page(status, message) {
  const text = message.replace(/</g, '&lt;');
  return new Response(`<!doctype html><meta charset="utf-8"><title>swarmtroopers</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0D0E11;color:#ECEEF2;font:14px/1.5 ui-monospace,Menlo,monospace;padding:24px;text-align:center"><p><span style="color:#FF5C7A">✕</span> ${text}</p><script>parent!==window&&parent.postMessage({type:'swarmtroopers-demo',scene:'url',state:'unavailable',message:${JSON.stringify(message).replace(/</g, '\\u003c')}},'*')</script>`, { status, headers: headers(false) });
}

function headers(cache) {
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "sandbox allow-scripts; frame-ancestors 'self'",
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
    'cache-control': cache ? 'public, max-age=0, s-maxage=600' : 'no-store',
  };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get('url')?.trim();
  const scripts = params.get('scripts') !== 'off';
  if (!SITES.has(raw)) return page(403, 'Only the example sites run here.');
  try {
    const { url, html } = await fetchPage(new URL(raw));
    return new Response(inject(html, url, scripts), { status: 200, headers: headers(true) });
  } catch (error) {
    if (error instanceof UserError) return page(422, error.message);
    if (error?.name === 'TimeoutError') return page(504, 'The site took too long to answer.');
    return page(502, 'The page could not be fetched.');
  }
}
