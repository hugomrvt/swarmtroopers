// GET /api/try?url=https://example.com
// Fetches a public HTML page, injects Swarm Troopers and a slow auto-scroll, and serves it sandboxed.
// The response is always sandboxed (opaque origin, no forms, no top navigation), so a proxied page
// cannot read this site's storage, submit credentials anywhere or navigate the visitor away.
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const CDN = 'https://unpkg.com/swarmtroopers@0.4.1/dist/swarmtroopers.iife.js';
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 9000;

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

function inject(html, url) {
  const head = `<base href="${escapeAttr(url.href)}"><meta name="referrer" content="no-referrer">`;
  const tail = `<script src="${CDN}" data-swarmtroopers-init='{"auto":true,"controls":true,"inspect":true}'></script>${DRIVER}`;
  let out = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, '');
  out = /<head\b[^>]*>/i.test(out) ? out.replace(/<head\b[^>]*>/i, (m) => m + head) : head + out;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, tail + '</body>') : out + tail;
  return out;
}

function page(status, message) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>swarmtroopers</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0D0E11;color:#ECEEF2;font:14px/1.5 ui-monospace,Menlo,monospace;padding:24px;text-align:center"><p><span style="color:#FF5C7A">✕</span> ${message.replace(/</g, '&lt;')}</p>`, { status, headers: headers(false) });
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
  const raw = new URL(request.url).searchParams.get('url')?.trim();
  if (!raw) return page(400, 'Add ?url= with the page to build.');
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return page(422, 'Only http and https addresses work.');
  let target;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    return page(400, 'That is not a valid address.');
  }
  try {
    const { url, html } = await fetchPage(target);
    return new Response(inject(html, url), { status: 200, headers: headers(true) });
  } catch (error) {
    if (error instanceof UserError) return page(422, error.message);
    if (error?.name === 'TimeoutError') return page(504, 'The site took too long to answer.');
    return page(502, 'The page could not be fetched.');
  }
}
