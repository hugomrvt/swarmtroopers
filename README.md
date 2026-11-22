# Swarm Troopers

**A swarm of cursors. Working in sync.**

[Website and playground](https://swarmtroopers.mrvt.app/) · [Watch a full page build](https://swarmtroopers.mrvt.app/try.html) · [Documentation](https://swarmtroopers.mrvt.app/docs/) · [npm](https://www.npmjs.com/package/swarmtroopers) · [Agent skill](skills/swarmtroopers-overlay/SKILL.md)

Swarm Troopers is an overlay for a page you already have. A swarm of named cursor agents builds that page in front of the reader with four tools: they type the text, frame the boxes, draw the rules and stamp the list items as the page scrolls into view, then hand the page back. It is free, MIT licensed, and has no runtime dependencies.

One orchestrator runs the show. It walks to each part of the page, sends a small squad there and checks the part once it is done. Each named agent keeps its own colour across sections, and the task at hand shows next to its pointer for a moment. The troopers follow the reader: wherever the page is scrolled or reloaded, agents come back on screen and work on what is in view. When the last element of the page is built, the last worker and the orchestrator close with a small high five where the orchestrator stands. The [live playground](https://swarmtroopers.mrvt.app/#playground) runs the actual library in four tabs: website, gestures, high five and full page.

Your HTML stays complete and stays the source of truth. The library only hides what it is about to build, then reveals it with a clip-path, so the layout never moves. Without JavaScript, with reduced motion or with the Off switch, the page is simply the page. The agents are scripted cursors: there is no model behind them, and the library makes no network request.

## Install

With a package manager:

```sh
npm i swarmtroopers
```

```js
import { create, controls } from 'swarmtroopers';

const swarmtroopers = create({ auto: true });
controls(swarmtroopers);
```

Or with one script tag from a pinned CDN, no build step:

```html
<script src="https://unpkg.com/swarmtroopers@0.4.1/dist/swarmtroopers.core.iife.js"
        data-swarmtroopers-init='{"auto": true, "controls": true}'></script>
```

For Claude Code, install the integration skill into your project (or add `--global` for all projects):

```sh
npx swarmtroopers skill
```

As an HTML element, in any template language:

```html
<script src="/vendor/swarmtroopers.core.iife.js"></script>
<swarmtroopers-overlay auto controls inspect tokens root="main"></swarmtroopers-overlay>
```

To self-host the script, copy `dist/swarmtroopers.core.iife.js` from `node_modules/swarmtroopers` and serve it from your own site. To use native ES modules without a bundler, copy the entire `dist/` directory to your static files and import `create` and `controls` from its `swarmtroopers.js` entry. Keep the generated chunk files alongside it, and keep adjacent CommonJS registry files if copying artifacts manually.

### Finale artwork

The lightweight core bundle includes the Swarm Troopers mark and draws the high-five hands as vectors in the two agents' colours. The full profile adds the illustrated hands: two SVG hands in two skin tones, embedded in the JavaScript as `data:` URLs, so there are no image files to host.

- Script tag: use the self-contained `dist/swarmtroopers.iife.js` instead of the core file. Do not load both scripts on the same page.
- ESM: add `import 'swarmtroopers/finale'` before creating instances.
- CommonJS: use `require('swarmtroopers/full')` instead of the core entry.

Even the full profile prepares the artwork only for enabled build work, not for inspection-only instances.

## Orchestrator and squads

The page is split into sections: the outermost `section`, `header`, `footer`, `article`, `aside`, `nav` or `[data-swarmtroopers-section]` elements under `root`, otherwise bands about one screen tall. The orchestrator handles them in reading order, the visible ones first.

1. It goes to the corner of the section. Its agents leave its pointer one after the other and fan out towards the section.
2. While they work, it sweeps the top edge and a light dashed outline marks the section.
3. Workers only take elements of their own section. Each new task shows next to the name ("Writing the title", "Framing the card") for a few seconds.
4. When nothing is left in their section, workers come back to the orchestrator and disappear.
5. Once every element of the section is built, the outline fades.
6. Once the whole page is built, a small clap plays where the orchestrator stands (the centre of the viewport is only a fallback). Two emoji-sized hands swing in, slap and rebound once. A short burst of strokes in the two agents' colours marks the contact, and each hand carries its agent's name tag: the last worker on the left, the orchestrator on the right. There is no panel and no veil, so the finished page stays fully visible. The clap clears after 3.54 seconds, never catches the pointer, and a wheel, touch, click or key dismisses it after the first half-second.

Gestures are paced to be followed, and a backlog only speeds them up by half at most. When the reader scrolls away, a task whose element left the screen is settled at once (shown if the reader went past it, put back for later if the reader went up), and its worker joins the squad working in view. An agent left far behind re-enters from the nearest edge. After a reload in the middle of the page, the orchestrator appears where the reader is and the troopers start there; what is above is built if the reader scrolls back up. Nothing in view waits forever. An element that stays on screen longer than `patience` without an agent simply appears, and anything scrolled past is shown at once. The name of a section comes from `data-swarmtroopers-section`, `aria-label`, its `id` or its first heading.

## Two ways to choose what gets built

**Auto mode** (`auto: true`) reads eligible elements within the discovery budget under `root`. Text runs are typed, boxes with a background, border or shadow are framed, thin lines are drawn as rules, media are framed, and items of a list are stamped from the previous one. Fixed and sticky elements, invisible elements and elements entirely outside the page horizontally (off-canvas menus, marquee copies) are left alone.

**Annotated mode** (the default) only builds elements matching `selector`, by default `[data-swarmtroopers]`. The value picks the tool.

| `data-swarmtroopers` value | Effect |
| --- | --- |
| empty or `auto` | Classified like in auto mode |
| `type`, `frame`, `rule`, `stamp`, `instant` | Forces a tool |
| `repeat` | Children are list items. The first is framed, the next ones are stamped |
| `scan` | Auto mode inside this element only |
| `skip` | Never touched, same as `data-swarmtroopers-skip` |

Both modes can be mixed; auto mode still leaves interactive controls and their enclosing containers visible, unless a `data-swarmtroopers` value forces a tool on them. A negative `tabindex` is a focus target, not a control. `data-swarmtroopers-skip` excludes a subtree in either mode.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `root` | `document.body` | Element or selector whose content gets built |
| `selector` | `"[data-swarmtroopers]"` | Annotated elements |
| `auto` | `false` | Classify everything under `root` |
| `trigger` | `"immediate"` | `"immediate"`, `"scroll"` (first scroll, wheel, touch move, pointer down or key press) or `"manual"` (call `start()`) |
| `quality` | `"auto"` | `"full"`, `"light"`, `"off"`. Saved choice takes priority, then reduced motion. Auto selects light for data saving or limited CPU/memory |
| `agents.max` | `6` | Workers on screen at once, besides the orchestrator (3 in light) |
| `speed` | `1` | Global speed multiplier |
| `palette` | Swarm Troopers agent colours | List of CSS colours, or `{ hue, count, lightness, chroma }` for an OKLCH palette |
| `inspect` | `false` | Once built, an agent labels the element under the mouse |
| `labels` | `false` | Sizes or tokens shown as elements are finished. Off by default: labels appear on inspection |
| `names` | `true` | Name tag on every pointer, with the current task for a moment. Pass a list to choose the workers' first names |
| `finale` | `true` | The closing high five once the whole page is built |
| `leadName` | `"Orchestrator"` | Name of the orchestrator, translated with the page language |
| `patience` | `2.4` | Seconds a visible element waits for an agent before it simply appears (1.4 on phones or in light mode) |
| `locale` | page `lang` | Language of tasks, section names and the orchestrator's default name (English and French built in) |
| `chat` | `false` | Speech bubbles for the orchestrator, off by default. `{ locale, lines, subjects, tasks, kinds, bubbles }` to adapt them. Lines and tasks follow the `lang` of the page (English and French built in) |
| `scale` | `1.2` | Size of pointers, name tags and bubbles (1.05 on phones) |
| `once` | `false` | `"session"` builds once per browser session |
| `maxTasks` | `400` | Maximum enrolled tasks (integer 0–10000); overflow remains visible. Each scan reads the style of at most max(100, maxTasks × 8) candidates that are not enrolled yet; annotated mode walks unannotated elements without reading them |
| `zIndex` | `2147483000` | Overlay canvas z-index |
| `storageKey` | `"swarmtroopers"` | Prefix of the keys kept in localStorage and sessionStorage |
| `plugins` | `[]` | Plugins, or `"tokens"` |

The default palette is ink (`#0d0e11` on light pages, `#eceef2` on dark ones), then `#7db4ff`, `#b98cff`, `#5fe3d0` and `#ff7eb6`. Named agents keep a stable colour based on their position in the name pool, even when they move to another section. Section survey outlines use a separate colour from the same palette. Name tabs choose dark or light text for contrast, and task captions stack on narrow screens. A custom `palette` replaces these colours; an object generates an OKLCH palette.

## API

```js
const swarmtroopers = create(options);

swarmtroopers.start();             // with trigger: 'manual'
swarmtroopers.pause(); swarmtroopers.resume();
swarmtroopers.finish();            // show everything now
swarmtroopers.refresh();           // pick up content added later (client-side navigation, lazy loading)
swarmtroopers.setQuality('light'); // 'full' | 'light' | 'off', remembered for the reader
swarmtroopers.destroy();           // remove everything and restore the page

swarmtroopers.quality;             // current budget
swarmtroopers.stats;               // { tasks, done, agents, active }
swarmtroopers.theme;               // colours read from the page

swarmtroopers.on('start', ({ tasks }) => {});
swarmtroopers.on('task', ({ el, tool }) => {});
swarmtroopers.on('done', ({ tasks, agents, duration }) => {});
swarmtroopers.on('quality', ({ quality }) => {});
```

`controls(swarmtroopers, { position, labels, container })` adds a small Full, Light, Off switch. Every label is configurable, so it can follow the language of the site.

## Localisation and chat

Task captions, section names and the orchestrator's name follow the `lang` of the page, or the `locale` option. English and French are built in. The finale shows the two agents' names and no other text.

Speech bubbles are off by default; `chat: true` turns them on. Their lines can be rewritten for any language or tone, for example `chat: { locale: 'en', lines: { done: ['Delivered'] } }`. The keys are `plan`, `rush`, `ready`, `reply` and `done`, where `{s}` is the section name and `{n}` the number of agents sent. The `done` line is the orchestrator's closing bubble when bubbles are on and the finale does not play, for example with `finale: false`.

Tasks combine a verb per tool (`tasks: { type: 'Writing {k}' }`) with a word per kind of element (`kinds: { title: 'the title' }`), the kinds being title, text, label, item, button, link, image, card, line, list and block. Passing these options turns the bubbles on; add `bubbles: false` to rewrite the tasks and keep the bubbles off.

## Design tokens

The `tokens` plugin labels finished elements with the design tokens that match their computed style, font size and colour for text, radius, background, padding and border for boxes. It reads the custom properties declared on `:root`, whatever their naming, and resolves them through the browser, so `clamp()`, `rem`, `color-mix()` and aliases all work. It also accepts tokens from outside the CSS, flat or in the DTCG format.

```js
import { create, tokens } from 'swarmtroopers';
import designTokens from './tokens.json';

create({ auto: true, inspect: true, plugins: [tokens({ source: designTokens })] });
```

## Custom tools

A tool is a generator. Each `yield` waits for the next frame and receives the elapsed time, so a gesture reads like a script.

```js
import { defineTool } from 'swarmtroopers';

defineTool('pop', function* (c) {
  const r = c.rect();
  yield* c.move({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, { width: Math.min(r.w, r.h) });
  yield* c.click();
  c.reveal.pop();
  yield* c.wait(0.2);
});
```

```html
<div data-swarmtroopers="pop">…</div>
```

The context also gives `shape()`, `hold()`, `dim()`, `mark()` for annotations, `label()`, and `text()` for the measured lines of a text. For the reveal itself there are `reveal.begin()`, `reveal.clip()` and `reveal.end()` to drive a clip-path by hand, `reveal.sweep(x, y)` to show the top-left part of the element with a soft edge (`x` and `y` from 0 to 1), and `reveal.settle()`, which shows the element at once like `reveal.pop()` but drops it into place with a small bounce.

## Frameworks

Swarm Troopers needs the DOM, so create it on the client once the content is mounted, and destroy it when the view goes away.

React and Next.js (App Router):

```jsx
'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'swarmtroopers';

export default function SwarmTroopersOverlay() {
  const pathname = usePathname();
  useEffect(() => {
    const swarmtroopers = create({ root: 'main', auto: true });
    return () => swarmtroopers.destroy();
  }, [pathname]);
  return null;
}
```

Vue:

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { create } from 'swarmtroopers';

let swarmtroopers;
onMounted(() => { swarmtroopers = create({ root: 'main', auto: true }); });
onBeforeUnmount(() => swarmtroopers?.destroy());
</script>
```

Svelte:

```svelte
<script>
  import { onMount } from 'svelte';
  import { create } from 'swarmtroopers';

  onMount(() => {
    const swarmtroopers = create({ root: 'main', auto: true });
    return () => swarmtroopers.destroy();
  });
</script>
```

Astro, with or without view transitions:

```astro
<script>
  import { create } from 'swarmtroopers';
  let swarmtroopers;
  document.addEventListener('astro:page-load', () => { swarmtroopers = create({ root: 'main', auto: true }); });
  document.addEventListener('astro:before-swap', () => swarmtroopers?.destroy());
</script>
```

Server-rendered imports are safe: nothing touches `window` until `create()` runs.

## Optional preload

Omit preload by default. If a noncritical region needs anti-flash behavior, use [`snippet/preload.html`](snippet/preload.html) and explicit `data-swarmtroopers-preload` markers. Never hide all of main or a critical hero. Marked controls and containers with controls or skipped content stay visible. The snippet respects Off/reduced motion and expires after 2.5 seconds if Swarm Troopers never starts.

## Accessibility and performance

The text is in the DOM from the start, so search engines and screen readers retain access. Reduced motion turns the build off unless the reader saved an explicit preference. Later system changes are followed the same way, without saving them. Focus reveals annotated controls immediately; print settles pending work and hides the overlay. The reader’s switch choice is remembered.

One canvas sits over the page, with a pixel ratio capped at 1.5 (1 in light). The render loop sleeps as soon as nothing moves, pauses in background tabs, and geometry is cached within each frame. The browser test reports main-thread usage during the opening build. Bounded discovery leaves excess content untouched; profile real pages and devices rather than assuming demo performance transfers.

Content hidden at load is counted later for Largest Contentful Paint. If that metric matters, keep the hero out with `data-swarmtroopers-skip`, or keep `trigger: "immediate"` so it is built first.

With a strict Content-Security-Policy, host the script on your own domain or allow its origin in `script-src`. Styles are added through constructable stylesheets, which `style-src` does not block. Give the preload snippet a nonce or a hash.

The embedded artwork and quality-dock mark use `data:` image URLs. Allow `data:` in `img-src` to display them. If image decoding is blocked or fails, the finale uses its vector fallback and the dock keeps its text label without a broken image.

Existing reveal animations (GSAP, AOS, Motion…) keep working: auto mode skips elements that are invisible when it starts. To hand an element to Swarm Troopers, remove its other animation.

## Browser support

The supported baseline is ordinary light DOM with viewport coordinates. The engine relies on Canvas 2D, clip-path, Path2D and modern observer APIs; without IntersectionObserver, everything counts as visible. Unavailable renderers, shadow-tree roots and documents that move the fixed overlay use visible passthrough, so the content stays readable.

The portability suite and the React Strict Mode and navigation fixtures run in Chrome, Firefox and Playwright WebKit. The landing page and demo suite runs in Chrome. Validate actual Safari, physical devices, assistive technologies and your own framework lifecycle on the target site.

## Robustness

Invalid configuration is rejected before host mutation. Explicitly missing roots and overlapping instances are rejected before they can hide unrelated content. The JSON bootstrap logs a diagnostic rather than throwing into the host page. Tool failures settle their element; fatal renderer failures restore the host. `destroy()` isolates cleanup errors, and `refresh()` reconciles removed nodes. Original clip-path values and priorities are restored. Plugin setup may return a teardown callback.

## Development

Use Node.js 20.19+, 22.12+, or 24 and later to work on the library. Development tools are pinned; the runtime still has no dependencies.

```sh
npm ci
npm run build        # dist/ (ESM, CJS, IIFE) and types
npm run typecheck
npm run test:docs    # generated links, anchors and reference coverage
npm test             # unit tests
npx playwright install chromium
npm run test:e2e     # browser checks on the landing page and demos
npm run test:portability # failure recovery, accessibility, dynamic DOM
npm run test:package # packed Bundler / NodeNext ESM and CJS consumers
npm run test:framework # actual React Strict Mode and navigation
npx playwright install firefox webkit
PLAYWRIGHT_BROWSER=firefox npm run test:portability
PLAYWRIGHT_BROWSER=webkit npm run test:framework
npm audit
npm run size
python3 -m http.server 8765
```

Open [localhost:8765](http://localhost:8765/) for the landing page and its live playground. The complete documentation is at `/docs/`, the everyday-website demo at `/demo/index.html`, the portfolio demo at `/demo/hugo.html` and the full product-page build at `/try.html`. The try page and the playground's full page tab run `sites/demo.html`, a made-up product page written for the demo. Run `npm run docs:build` to regenerate the documentation after editing `docs/content.mjs`. To run browser checks with an installed Chrome instead of Playwright's Chromium, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. To regenerate the finale hands from a traced SVG, run `python3 scripts/prepare-high-five.py path/to/raw.svg`, then `npm run build`.

An agent skill that installs Swarm Troopers on a site lives in [`skills/swarmtroopers-overlay/SKILL.md`](skills/swarmtroopers-overlay/SKILL.md).

## Credits

The idea of a page assembled live by cursors comes from Joel Califa's Swarm demo. Swarm Troopers shares no code with it: the architecture, motion model, tools and visuals are its own.

## Licence

MIT, © 2026 Hugo Mourlevat.
