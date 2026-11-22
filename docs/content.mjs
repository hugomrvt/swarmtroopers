const escapeHTML = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function code(language, source) {
  return `<pre data-language="${escapeHTML(language)}"><code>${escapeHTML(source.trim())}</code></pre>`;
}

const table = (headers, rows) => `<table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

export const pages = [
  {
    slug: 'index', title: 'Meet Swarm Troopers', group: 'Getting started',
    description: 'Coordinate a swarm of named cursor agents on your existing page.',
    body: `
<p>Swarm Troopers is a browser overlay that reveals your existing HTML through familiar cursor gestures. Agents type text, frame cards, draw dividers, and stamp repeated items. One orchestrator coordinates small squads around the content currently in view.</p>
<p>Your HTML remains complete. Swarm Troopers does not generate copy, duplicate elements, or rearrange your layout. When JavaScript is unavailable, the page remains readable. Readers can skip the effect with the quality controls.</p>
<aside class="note"><strong>Install.</strong> Run <code>npm i swarmtroopers</code>, or add one script tag from a pinned CDN. No build step is required.</aside>
<h2 id="first-build">Your first build</h2>
<ol><li>Add the pinned script from the CDN (<code>https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js</code>), or self-host it: install the package with <code>npm i swarmtroopers</code> and copy <code>dist/swarmtroopers.core.iife.js</code> from <code>node_modules/swarmtroopers</code> into your website’s public files.</li><li>Add the script after your page content. Swarm Troopers starts when the DOM is ready.</li></ol>
${code('html', `<main>
  <h1>A page with a little character.</h1>
  <p>Your own content, already here.</p>
</main>
<script src="https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{"root":"main","auto":true,"controls":true}'></script>`)}
<p>The script creates <code>window.swarmtroopers</code>, exposes helpers through <code>window.SwarmTroopers</code>, and adds Full, Light, and Off controls. Keep the controls outside the animated content; the built-in helper handles this for you.</p>
<h2 id="how-it-works">What happens on the page</h2>
<ol><li>The scanner converts eligible elements into tasks and groups them by section.</li><li>The orchestrator sends named cursor agents to visible work first. Each named agent keeps its own color as it shares tasks and moves between sections.</li><li>Each tool reveals its element in place. A patience limit prevents untouched visible content from staying hidden indefinitely.</li><li>After every task is done, a small clap where the orchestrator stands closes the build and the troopers leave. Optional pointer inspection can still identify finished elements.</li></ol>
<p>The animated root is scanned through its descendants, so place the elements to build inside <code>root</code>. Scope Swarm Troopers to <code>main</code> or a specific showcase rather than including persistent navigation.</p>
<h2 id="choose-a-path">Choose your integration</h2>
<ul><li><a href="installation.html">Install Swarm Troopers</a> for the npm package, a CDN script tag, or a self-hosted script.</li><li><a href="markup.html">Choose auto or annotated mode</a> to control what gets built.</li><li><a href="frameworks.html">Follow a framework recipe</a> for mount, navigation, and cleanup.</li><li><a href="examples.html">Try the working examples</a> before changing your site.</li></ul>
<h2 id="when-to-use">Where Swarm Troopers fits</h2>
<p>Use Swarm Troopers for a product introduction, portfolio, creative landing page, or a focused interactive example. Keep reading-critical documentation, checkout forms, and frequently used application interfaces immediately available. These documentation pages deliberately stay still.</p>`
  },
  {
    slug: 'installation', title: 'Installation', group: 'Getting started',
    description: 'Install from npm, load from a CDN, self-host the script, or use browser-native ES modules.',
    body: `
<h2 id="build-checkout">Develop from source</h2>
<p>To work on Swarm Troopers itself, clone the repository. Development requires Node.js 20.19+, 22.12+, or 24 and later. Swarm Troopers itself has no runtime dependencies. From the directory containing <code>package.json</code>:</p>
${code('sh', `npm ci
npm run build
python3 -m http.server 8765`)}
<p>Open <code>http://localhost:8765/</code> for the landing page, or <code>/demo/index.html</code> for the everyday-website demo. Serve files over HTTP; opening an ES module directly from a <code>file:</code> URL is not an equivalent test.</p>
<h2 id="script-tag">One script tag</h2>
<p>Load the pinned file from the CDN, or self-host it by copying <code>dist/swarmtroopers.core.iife.js</code> from <code>node_modules/swarmtroopers</code> into your public directory. This lightweight script embeds the mark and draws the finale hands as vectors in the two agents’ colors. Choose <code>dist/swarmtroopers.iife.js</code> instead for the self-contained bundle with the illustrated hands. Do not load both script profiles on one page.</p>
${code('html', `<script src="https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{
    "root": "main",
    "auto": true,
    "inspect": true,
    "controls": { "position": "bottom-right" }
  }'></script>`)}
<p><code>data-swarmtroopers-init</code> must contain valid JSON, including double-quoted keys. An empty attribute uses default options. Without that attribute, the script only makes <code>window.SwarmTroopers</code> available and registers the custom element; it does not create an instance automatically.</p>
${code('html', `<script src="https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js"></script>
<script>
  const swarmtroopers = SwarmTroopers.create({ root: 'main', auto: true });
  SwarmTroopers.controls(swarmtroopers);
</script>`)}
<p>Automatic startup stores the instance as <code>window.swarmtroopers</code> and dispatches <code>window</code>’s <code>swarmtroopers-ready</code> CustomEvent with the instance in <code>event.detail</code>. Register your listener before loading the automatic script if you need it.</p>
<h2 id="local-package">Install from npm</h2>
<p>Install the package from your application directory.</p>
${code('sh', `npm i swarmtroopers`)}
${code('js', `import { create, controls } from 'swarmtroopers';

const swarmtroopers = create({ root: 'main', auto: true });
controls(swarmtroopers);`)}
<p>Call <code>swarmtroopers.destroy()</code> when the view is removed, inside its unmount or teardown callback. See the <a href="frameworks.html">framework recipes</a> for cleanup that runs at the right time.</p>
<h2 id="agent-skill">Agent skill</h2>
<p>To let Claude Code integrate Swarm Troopers for you, copy the packaged skill into your project. Add <code>--global</code> to install it for every project, or <code>--dir &lt;path&gt;</code> to choose the folder.</p>
${code('sh', `npx swarmtroopers skill`)}
<p>Then ask Claude Code to add Swarm Troopers to a section of your site. Read the skill before installing it: <a href="https://github.com/hugomrvt/swarmtroopers/tree/main/skills/swarmtroopers-overlay">skills/swarmtroopers-overlay on GitHub</a>. The package itself is <a href="https://www.npmjs.com/package/swarmtroopers">swarmtroopers on npm</a>.</p>
<h2 id="optional-artwork">Optional finale artwork</h2>
<p>The main ESM and CommonJS entries ship no finale artwork; the closing clap draws vector hands in the two agents’ colors. The supplied hand artwork is two SVG hands in two skin tones, embedded as <code>data:</code> URLs. Enable it in ESM with a side-effect import before creating instances:</p>
${code('js', `import { create } from 'swarmtroopers';
import 'swarmtroopers/finale';
const swarmtroopers = create({ root: 'main', auto: true });`)}
<p>For CommonJS, use <code>require('swarmtroopers/full')</code>. The self-contained <code>dist/swarmtroopers.iife.js</code> script includes the same artwork for classic-script integrations. Even in that full build, the hand images are prepared only when enabled build work starts; disabled finales and inspection-only instances do not decode them.</p>
<h2 id="browser-modules">Native ES modules and CommonJS</h2>
<p>For browser-native modules, copy the entire <code>dist/</code> directory, including generated <code>chunk-*.js</code> files. Its small <code>swarmtroopers.js</code> entry imports a shared chunk; copying that entry alone will fail.</p>
${code('html', `<script type="module">
  import { create } from '/vendor/swarmtroopers/swarmtroopers.js';
  create({ root: 'main', auto: true });
</script>`)}
<p>Keep adjacent CommonJS registry files when copying artifacts manually; installing the complete package handles this. Node toolchains can resolve the CommonJS entry with <code>require('swarmtroopers')</code>. Importing the package is safe during server rendering, but calling <code>create()</code> requires a mounted browser document.</p>
${table(['Entry', 'Purpose'], [
['<code>dist/swarmtroopers.core.iife.js</code>', 'Lightweight self-contained classic script; exposes <code>window.SwarmTroopers</code>.'],
['<code>dist/swarmtroopers.iife.js</code>', 'Full single-file profile with the illustrated finale hands.'],
['<code>dist/finale.js</code>', 'Optional ESM artwork registration; retain its shared chunks.'],
['<code>dist/swarmtroopers.js</code>', 'ES module entry with adjacent shared chunks.'],
['<code>dist/swarmtroopers.cjs</code>', 'CommonJS entry for compatible toolchains.'],
['<code>dist/element.js</code>', 'Custom-element registration entry; keep its chunks alongside it.'],
['<code>dist/types/</code>, <code>dist/types-cjs/</code>', 'Separate ESM and CommonJS declarations selected by package exports.'],
])}
<h2 id="preload">Avoid a first-paint flash</h2>
<p>Omit preload by default. For a noncritical animation region that needs anti-flash behavior, copy <a href="../snippet/preload.html">the optional preload snippet</a> into head and explicitly mark eligible elements with <code>data-swarmtroopers-preload</code>. Never hide all of main or a critical hero. The snippet leaves marked controls and containers with controls or skipped descendants visible.</p>
<p>The snippet respects Off and reduced motion, and removes its class after 2.5 seconds if Swarm Troopers never loads. Swarm Troopers also clears the class on initialization or configuration failure. Match its storage prefix to <code>storageKey</code>. With JavaScript disabled it does not hide content.</p>
<p>A strict CSP needs a nonce or hash on the preload script and style, or the snippet should be omitted. See <a href="accessibility.html#content-security-policy">Content Security Policy</a> for the library’s own image and stylesheet behavior.</p>`
  },
  {
    slug: 'markup', title: 'Markup and scanning', group: 'Getting started',
    description: 'Choose what Swarm Troopers builds without changing the content or its layout.',
    body: `
<h2 id="automatic">Automatic mode</h2>
${code('js', `const swarmtroopers = create({ root: 'main', auto: true });`)}
<p>Auto mode examines computed styles. Text-only runs become typing tasks; backgrounds, borders, shadows, and media become frames; thin rules become drawing tasks. Similar siblings can form a repeat group. Very large containers are left in place while their contents are scanned, avoiding a long drag across an entire screen.</p>
<p>Auto mode skips fixed or sticky elements, invisible content, excluded elements, and content fully outside the horizontal viewport. Interactive controls and their enclosing task containers remain visible in auto mode, unless a <code>data-swarmtroopers</code> value forces a tool on them; a negative <code>tabindex</code> is a focus target, not a control. Discovery is bounded by <code>maxTasks</code> and a budget of style reads on candidates that are not enrolled yet (annotated mode walks unannotated elements without reading them); overflow is left untouched. Content that is hidden when scanning begins is not automatically revisited when another animation reveals it; call <code>refresh()</code> after it becomes eligible, or give one animation ownership of it.</p>
<h2 id="annotated">Annotated mode</h2>
<p>Without <code>auto: true</code>, only descendants matching <code>selector</code> are selected. The default selector is <code>[data-swarmtroopers]</code>. An annotation can also override automatic classification.</p>
${code('html', `<main>
  <h1 data-swarmtroopers="type">A precise introduction.</h1>
  <article data-swarmtroopers="frame">A card in its original place.</article>
  <hr data-swarmtroopers="rule">
  <p data-swarmtroopers="instant">Show this without an agent gesture.</p>
</main>`)}
${table(['Value', 'Behavior'], [
['Empty or <code>auto</code>', 'Classify this element from computed styles.'],
['<code>type</code>', 'Reveal text with a caret and a typing rhythm.'],
['<code>frame</code>', 'Drag a frame to reveal a box, image, or field.'],
['<code>rule</code>', 'Trace a horizontal or vertical divider.'],
['<code>stamp</code>', 'Copy from a preceding repeat item; without a source, use a frame.'],
['<code>instant</code>', 'Reveal without a worker gesture.'],
['<code>repeat</code>', 'Treat children as repeated items; eligible later frames become stamps.'],
['<code>scan</code>', 'Turn on automatic scanning within this subtree.'],
['<code>skip</code>', 'Exclude the element and its descendants.'],
['A registered custom name', 'Use the tool registered with <code>defineTool()</code>. Unknown tool names fall back to framing.'],
])}
<h2 id="repeat-groups">Repeated items and mixed modes</h2>
${code('html', `<section data-swarmtroopers="scan">
  <h2>This section is scanned automatically.</h2>
  <ul data-swarmtroopers="repeat">
    <li>First item</li>
    <li>Second item</li>
    <li>Third item</li>
  </ul>
</section>
<nav data-swarmtroopers-skip>Persistent navigation stays available.</nav>`)}
<p><code>repeat</code> preserves the actual children. It does not clone DOM nodes. Auto-detected repetition groups siblings by tag and classes; use explicit annotations when the structure is unusual. The scanner ignores its own overlay and controls.</p>
<h2 id="sections">Name and scope each section</h2>
<p>The outermost semantic section under the root owns its squad. Swarm Troopers recognizes <code>section</code>, <code>header</code>, <code>footer</code>, <code>article</code>, <code>aside</code>, <code>nav</code>, and <code>[data-swarmtroopers-section]</code>. Without section markup, it uses viewport-sized document bands.</p>
${code('html', `<main>
  <div data-swarmtroopers-section="Our work">
    <h2 data-swarmtroopers="type">Selected projects</h2>
  </div>
</main>`)}
<p>Section names prefer <code>data-swarmtroopers-section</code>, then <code>aria-label</code>, a usable ID, the first heading, or the section role. Put a naming attribute on the section, not on the animated root itself.</p>
<h2 id="exclusions">Keep important content immediately visible</h2>
<p>Use <code>data-swarmtroopers-skip</code> on hero content when Largest Contentful Paint matters, on essential controls, and on any element owned by another animation. This exclusion works in both modes and excludes the subtree. Manual annotations can select fixed or sticky content that auto mode would reject; test those explicitly rather than assuming they follow normal document coordinates.</p>`
  },
  {
    slug: 'options', title: 'Options reference', group: 'Reference',
    description: 'Every SwarmTroopersOptions field, its default, and the behavior it controls.',
    body: `
<p>Pass these options to <code>create(options)</code> or <code>new SwarmTroopers(options)</code>. The IIFE’s JSON initializer accepts the same serializable fields plus its own <code>controls</code> configuration. DOM elements, functions, and plugin objects require JavaScript.</p>
<h2 id="selection-options">Content and startup</h2>
${table(['Option', 'Type', 'Default', 'Behavior'], [
['<code>root</code>', '<code>Element | string | null</code>', '<code>document.body</code>', 'Scan descendants of this element or selector. An explicitly missing selector throws before host mutations; it never falls back to body.'],
['<code>selector</code>', '<code>string</code>', '<code>"[data-swarmtroopers]"</code>', 'Which descendants carry annotations. Annotation values still come from <code>data-swarmtroopers</code>.'],
['<code>auto</code>', '<code>boolean</code>', '<code>false</code>', 'Automatically classify eligible descendants.'],
['<code>trigger</code>', '<code>"immediate" | "scroll" | "manual"</code>', '<code>"immediate"</code>', 'Start on initialization, first scroll/wheel/touchmove/keydown/pointerdown, or <code>start()</code>.'],
['<code>once</code>', '<code>false | "session"</code>', '<code>false</code>', 'After completion, skip another build using the same storage prefix in that browser session.'],
['<code>maxTasks</code>', '<code>number</code>', '<code>400</code>', 'Maximum enrolled tasks (integer 0–10000). Overflow stays visible. Each scan reads the style of at most max(100, maxTasks × 8) candidates that are not enrolled yet.'],
['<code>storageKey</code>', '<code>string</code>', '<code>"swarmtroopers"</code>', 'Storage prefix; quality uses localStorage and completion uses sessionStorage.'],
])}
<h2 id="motion-options">Rendering and pacing</h2>
${table(['Option', 'Type', 'Default', 'Behavior'], [
['<code>quality</code>', '<code>"auto" | "full" | "light" | "off"</code>', '<code>"auto"</code>', 'Initial rendering budget; a saved preference takes precedence. See <a href="controls.html#quality-resolution">resolution order</a>.'],
['<code>agents.max</code>', '<code>number</code>', '<code>6</code> full; <code>3</code> light', 'Integer 1–32; Light mode still caps workers at 3.'],
['<code>speed</code>', '<code>number</code>', '<code>1</code>', 'Gesture speed multiplier. Finite multiplier from 0.01 to 100; larger values finish gestures faster.'],
['<code>patience</code>', '<code>number</code>', '<code>2.4</code> seconds; <code>1.4</code> on narrow screens or light mode', 'How long visible pending work waits before simply appearing. Blocking parent tasks can appear sooner.'],
['<code>scale</code>', '<code>number</code>', '<code>1.2</code>; <code>1.05</code> below 600px', 'Finite pointer, task-caption, bubble, and label size multiplier from 0.25 to 4.'],
['<code>zIndex</code>', '<code>number</code>', '<code>2147483000</code>', 'Overlay canvas stacking level. The built-in controls have their own fixed stacking level.'],
])}
<h2 id="appearance-options">Appearance and language</h2>
${table(['Option', 'Type', 'Default', 'Behavior'], [
['<code>palette</code>', '<code>string[] | PaletteSpec</code>', 'Swarm Troopers palette', 'CSS colors for agent identities and section survey outlines, or an OKLCH palette specification.'],
['<code>inspect</code>', '<code>boolean</code>', '<code>false</code>', 'After construction, pointer hover brings an agent to label a finished element.'],
['<code>labels</code>', '<code>boolean</code>', '<code>false</code>', 'Show labels during construction. They remain suppressed on narrow screens; inspection can still label.'],
['<code>names</code>', '<code>boolean | string[]</code>', '<code>true</code>', 'Built-in first names, a custom pool, or no name tags. A custom array must contain at least one non-empty name.'],
['<code>leadName</code>', '<code>string</code>', 'Localized “Orchestrator”', 'Override the orchestrator’s name.'],
['<code>locale</code>', '<code>string</code>', 'Document <code>lang</code>, then <code>en</code>', 'Language for task captions, section-role names, the orchestrator’s default name, and bubbles. English and French are built in.'],
['<code>chat</code>', '<code>boolean | ChatOptions</code>', '<code>false</code>', 'Speech bubbles and optional localized text overrides. An options object enables bubbles unless <code>bubbles: false</code>.'],
['<code>finale</code>', '<code>boolean</code>', '<code>true</code>', 'Play the closing clap where the orchestrator stands after a natural build. <code>finish()</code> does not play it.'],
['<code>plugins</code>', '<code>Array&lt;SwarmTroopersPlugin | "tokens"&gt;</code>', '<code>[]</code>', 'Plugin instances or the built-in <code>"tokens"</code> shorthand.'],
])}
<h2 id="palette-spec">PaletteSpec</h2>
<p>The default agent colors are the lead in page ink (<code>#0d0e11</code> on light pages, <code>#eceef2</code> on dark ones), then blue <code>#7db4ff</code>, violet <code>#b98cff</code>, teal <code>#5fe3d0</code>, and pink <code>#ff7eb6</code>. Named agents keep a stable color based on their position in the name pool, even across sections. Section survey outlines use a separate color from the same palette. A custom list replaces these colors. The supplied hand artwork keeps its own two skin tones; without it, the finale hands take the two agents’ colors.</p>
${code('js', `create({
  root: 'main', auto: true,
  palette: { hue: 210, count: 6, lightness: 0.68, chroma: 0.16 },
});`)}
${table(['Field', 'Default', 'Meaning'], [
['<code>hue</code>', '<code>40</code>', 'First hue in degrees; subsequent hues use golden-angle steps.'],
['<code>count</code>', '<code>8</code>', 'Integer number of generated colors from 1 to 64.'],
['<code>lightness</code>', '<code>0.6</code> light page; <code>0.76</code> dark page', 'OKLCH lightness from 0 to 1 when generating through Swarm Troopers.'],
['<code>chroma</code>', '<code>0.16</code>', 'Requested OKLCH chroma; it decreases until a color fits sRGB.'],
])}
<p>Numeric options are bounded: speed 0.01–100, scale 0.25–4, nonnegative finite patience, integer agents.max 1–32, integer maxTasks 0–10000, and integer zIndex 0–2147483647. Palette specifications accept count 1–64, lightness/chroma 0–1 and finite hue from -360000 to 360000. Options are read at construction. To change an option without a setter, destroy the instance and create another. Object shape, enums, selector syntax and bounded numeric fields are validated before host mutations. Invalid script initialization logs a diagnostic without hiding content; direct JavaScript creation throws for invalid configuration.</p>`
  },
  {
    slug: 'api', title: 'JavaScript API', group: 'Reference',
    description: 'Create, control, inspect, and clean up a Swarm Troopers instance.',
    body: `
<h2 id="exports">Package exports</h2>
${code('js', `import {
  SwarmTroopers, create, controls, tokens, defineTool, version,
} from 'swarmtroopers';`)}
<p><code>create(options?)</code> returns a new <code>SwarmTroopers</code>; <code>new SwarmTroopers(options)</code> is equivalent. <code>controls()</code> returns a control element, <code>tokens()</code> returns a plugin, and <code>defineTool(name, generator)</code> registers a tool for subsequent tasks. <code>version</code> is the built package version. The IIFE exposes these on <code>window.SwarmTroopers</code>.</p>
<p>The separate <code>swarmtroopers/element</code> entry exports <code>SwarmTroopersOverlayElement</code> and <code>defineElement</code>, and registers the <code>swarmtroopers-overlay</code> tag as a side effect. The IIFE includes that registration; the main ES module entry does not.</p>
<h2 id="methods">Lifecycle methods</h2>
${table(['Method', 'Result and behavior'], [
['<code>start(): void</code>', 'Starts a manual or not-yet-started instance. Repeated calls are ignored.'],
['<code>pause(): void</code>', 'Pauses build updates without revealing pending content.'],
['<code>resume(): void</code>', 'Resumes a paused instance and wakes rendering.'],
['<code>finish(): void</code>', 'Reveals existing tasks, clears agents and annotations, and skips the finale. Completion can emit <code>done</code>.'],
['<code>refresh(): void</code>', 'Reconciles removed descendants, scans for new eligible ones, and invalidates geometry. It does not replay known elements or detect in-place text changes automatically.'],
['<code>setQuality(q): void</code>', '<code>q</code> is <code>full</code>, <code>light</code>, or <code>off</code>; saves the preference and updates the budget. Off finishes and removes the canvas.'],
['<code>destroy(): void</code>', 'Cancels rendering and tools; removes the overlay, owned elements, observers, listeners, and pending classes. Idempotent.'],
['<code>own(element): void</code>', 'Registers a DOM element to be removed with the instance. Used by built-in controls.'],
['<code>on(type, handler): () =&gt; void</code>', 'Registers an event listener and returns an unsubscribe function.'],
['<code>off(type, handler): void</code>', 'Removes that handler for the event type.'],
])}
<p><code>destroy()</code> is final for that instance. Replay by creating a new one; neither <code>start()</code> nor changing Off back to Full replays completed content.</p>
<h2 id="properties">Read-only properties</h2>
${code('js', `swarmtroopers.root;    // Resolved root Element
swarmtroopers.quality; // 'full' | 'light' | 'off'
swarmtroopers.stats;   // { tasks, done, agents, active }
swarmtroopers.theme;   // { background, text, rgb, palette }`)}
<p><code>stats.tasks</code> is the number of collected tasks; <code>done</code> counts completed tasks, <code>agents</code> counts agents spawned during the instance, and <code>active</code> is the current agent count. These are snapshots, not DOM inventories. An instance created Off without inspection may not collect tasks at all.</p>
<p><code>theme.background</code> and <code>theme.text</code> are resolved colors, <code>rgb</code> is the background RGB tuple, and <code>palette</code> is the color list used for agent identities and section survey outlines. Use these values when styling custom controls.</p>
<h2 id="events">Events and timing</h2>
${table(['Event', 'Payload', 'When'], [
['<code>start</code>', '<code>{ tasks: number }</code>', 'A build starts. Immediate startup occurs inside construction, before a later listener can subscribe.'],
['<code>task</code>', '<code>{ el: SwarmTroopersElement, tool: string }</code>', 'A task completes, including tasks revealed immediately.'],
['<code>done</code>', '<code>{ tasks: number, agents: number, duration: number }</code>', 'The instance completes its build; duration is elapsed seconds. This does not wait for the finale to disappear.'],
['<code>quality</code>', '<code>{ quality: Quality }</code>', 'A quality change takes effect. Re-selecting the current value does not emit a change.'],
])}
${code('js', `const swarmtroopers = create({ root: 'main', auto: true, trigger: 'manual' });
const unsubscribe = swarmtroopers.on('done', ({ tasks, duration }) => {
  console.log(tasks, 'elements completed in', duration, 'seconds');
});
swarmtroopers.on('start', ({ tasks }) => console.log('Starting', tasks));
swarmtroopers.start();

// Keep unsubscribe for your view's teardown callback.`)}
<p>When the view unmounts, call <code>unsubscribe()</code> to remove this listener and <code>swarmtroopers.destroy()</code> to clean up the instance. Keep that teardown separate from the startup code above.</p>
<p>Use manual startup when you must observe the first <code>start</code> event. Instances initially Off or already skipped by <code>once</code> do not perform a normal build. Event handler exceptions are logged without preventing other listeners from running.</p>
<h2 id="types">TypeScript surface</h2>
<p>The package exports <code>SwarmTroopersOptions</code>, <code>SwarmTroopersStats</code>, <code>SwarmTroopersEventMap</code>, <code>SwarmTroopersElement</code>, <code>SwarmTroopersPlugin</code>, <code>ControlsOptions</code>, <code>TokensOptions</code>, <code>ChatOptions</code>, <code>ChatLines</code>, <code>ChatKey</code>, <code>Quality</code>, <code>QualitySetting</code>, <code>Trigger</code>, <code>CursorShape</code>, <code>PaletteSpec</code>, <code>Point</code>, <code>Rect</code>, <code>Tool</code>, <code>ToolContext</code>, <code>ToolGen</code>, <code>Agent</code>, <code>Task</code>, <code>AnnotationInit</code>, and <code>AnnotationKind</code>. DOM-facing APIs require DOM types in your TypeScript application.</p>`
  },
  {
    slug: 'element', title: 'HTML custom element', group: 'Guides',
    description: 'Configure Swarm Troopers declaratively in any template language.',
    body: `
<h2 id="register-element">Register once</h2>
<p>The classic IIFE registers the element automatically. With package modules, import its separate entry once in client code:</p>
${code('js', `import 'swarmtroopers/element';`)}
${code('html', `<main>
  <h1>Your existing page</h1>
</main>
<swarmtroopers-overlay auto inspect tokens controls root="main"></swarmtroopers-overlay>`)}
<p>The element is configuration, not a wrapper. It hides itself and targets content elsewhere through <code>root</code>. Keep content outside it. Connection creates one instance after DOM readiness; disconnection destroys that instance.</p>
<h2 id="attributes">Supported attributes</h2>
${table(['Attribute', 'Value / default', 'Effect'], [
['<code>root</code>', 'Selector; body if absent', 'Target content root.'],
['<code>selector</code>', '<code>[data-swarmtroopers]</code>', 'Annotation selector.'],
['<code>auto</code>', 'Absent = false', 'Automatic scanning when present and not <code>"false"</code>.'],
['<code>inspect</code>', 'Absent = false', 'Enable finished-element inspection.'],
['<code>tokens</code>', 'Absent = false', 'Install the built-in tokens plugin.'],
['<code>controls</code>', 'Absent = no controls', 'Enable controls; an optional corner value sets position.'],
['<code>quality</code>', '<code>auto</code>', '<code>auto</code>, <code>full</code>, <code>light</code>, or <code>off</code>.'],
['<code>trigger</code>', '<code>immediate</code>', '<code>immediate</code>, <code>scroll</code>, or <code>manual</code>.'],
['<code>speed</code>', '<code>1</code>', 'Numeric gesture multiplier; use positive values.'],
['<code>scale</code>', 'Responsive default', 'Numeric size multiplier; use positive values.'],
['<code>labels</code>', '<strong>true when absent</strong>', 'Use <code>labels="false"</code> to match the JavaScript default.'],
['<code>names</code>', 'Built-in pool', '<code>false</code> hides names; a comma-separated list of at least two names replaces the pool.'],
['<code>lang</code>', 'Document language', 'Override Swarm Troopers’ text locale for this element.'],
['<code>chat</code>', 'Absent = false', 'Enable orchestrator bubbles.'],
['<code>finale</code>', 'Absent = true', '<code>false</code> disables the closing clap.'],
['<code>once</code>', 'Absent = false', '<code>session</code> enables session completion storage.'],
])}
${code('html', `<swarmtroopers-overlay
  root="main" auto inspect tokens
  controls="bottom-right" labels="false"
  names="Ada, Mia, Iris" lang="en"
></swarmtroopers-overlay>`)}
<p>Boolean attributes are on when present unless their string value is exactly <code>"false"</code>. For example, <code>chat="0"</code> still enables chat. A single custom name such as <code>names="Ada"</code> currently uses the built-in name pool; JavaScript’s <code>names: ['Ada']</code> supports a one-name pool.</p>
<h2 id="ready-event">Access the instance</h2>
${code('js', `const element = document.createElement('swarmtroopers-overlay');
element.setAttribute('root', 'main');
element.setAttribute('auto', '');
element.setAttribute('trigger', 'manual');
element.addEventListener('swarmtroopers-ready', (event) => {
  const swarmtroopers = event.detail;
  swarmtroopers.on('done', (stats) => console.log(stats));
  swarmtroopers.start();
});
document.body.appendChild(element);

// Once connected, element.swarmtroopers is the same instance.`)}
<p>Attach the event listener before connection if you must catch readiness. The event bubbles, and its detail is the same instance exposed as <code>element.swarmtroopers</code>.</p>
<h2 id="configuration-limits">Configuration is read on connection</h2>
<p>Attributes are not observed for live changes. Updating <code>speed</code>, <code>root</code>, or <code>lang</code> afterward does not reconfigure the running instance. Use its supported methods for quality or lifecycle changes; use the JavaScript API for object plugins, custom labels, palettes, <code>leadName</code>, <code>patience</code>, or other options without attributes. There is no automatic JavaScript-options-to-attributes mapping.</p>
<p><code>defineElement(name = 'swarmtroopers-overlay')</code> registers the element under its default tag. A constructor can only be registered under one name, so calling it with another name after the default registration throws.</p>`
  },
  {
    slug: 'frameworks', title: 'Framework integrations', group: 'Guides',
    description: 'Mount one instance on the client and clean it up with the view.',
    body: `
<p>Install the npm package into your application first, as described in <a href="installation.html#local-package">Installation</a>. These recipes assume the listed framework is already part of your project. Swarm Troopers does not install React, Vue, Svelte, Astro, Angular, or a router.</p>
<h2 id="react">React</h2>
<p>Create the instance in an effect after content mounts. Keep the root stable, and return cleanup. Development Strict Mode can exercise setup and cleanup twice; the cleanup is essential.</p>
${code('jsx', `import { useEffect } from 'react';
import { create, controls } from 'swarmtroopers';

export function SwarmTroopersOverlay() {
  useEffect(() => {
    const swarmtroopers = create({ root: 'main', auto: true });
    controls(swarmtroopers);
    return () => swarmtroopers.destroy();
  }, []);
  return null;
}`)}
<p>Use <a href="https://react.dev/reference/react/useEffect" target="_blank" rel="noopener">React’s effect lifecycle</a> to synchronize with an external DOM system. Do not create Swarm Troopers during render.</p>
<h2 id="next">Next.js App Router</h2>
<p>Use a client component. A pathname dependency recreates the instance after route changes; ensure the target page content has mounted before starting, especially with streamed or suspended content. For content arriving later, call <code>refresh()</code> after it becomes available.</p>
${code('jsx', `'use client';
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
}`)}
<p>See the framework’s <a href="https://nextjs.org/docs/app/api-reference/functions/use-pathname" target="_blank" rel="noopener">usePathname reference</a> for routing constraints in your application.</p>
<h2 id="vue-nuxt">Vue and Nuxt</h2>
${code('vue', `<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { create } from 'swarmtroopers';

let swarmtroopers;
onMounted(() => {
  swarmtroopers = create({ root: 'main', auto: true });
});
onBeforeUnmount(() => swarmtroopers?.destroy());
</script>`)}
<p><a href="https://vuejs.org/api/composition-api-lifecycle.html" target="_blank" rel="noopener">Vue lifecycle hooks</a> keep browser work outside server rendering. In Nuxt, put this in a <code>.client.vue</code> component or mount it inside <code>&lt;ClientOnly&gt;</code>. If your router keeps a layout mounted, subscribe to navigation after its DOM update and recreate or refresh deliberately; mounting a second global instance is not navigation handling.</p>
<h2 id="svelte">Svelte and SvelteKit</h2>
${code('svelte', `<script>
  import { onMount } from 'svelte';
  import { create } from 'swarmtroopers';

  onMount(() => {
    const swarmtroopers = create({ root: 'main', auto: true });
    return () => swarmtroopers.destroy();
  });
</script>`)}
<p>The synchronous <a href="https://svelte.dev/docs/svelte/lifecycle-hooks" target="_blank" rel="noopener">onMount callback</a> returns teardown. Do not make this callback async: returning a Promise is not the cleanup function. In persistent layouts, handle later navigation separately.</p>
<h2 id="astro">Astro and client navigation</h2>
<p>A plain Astro page can use a processed client script after its content. When using the client router, create on <code>astro:page-load</code> and destroy before the document is swapped. Keep this script registered once.</p>
${code('astro', `<script>
  import { create, type SwarmTroopers } from 'swarmtroopers';
  let swarmtroopers: SwarmTroopers | undefined;

  document.addEventListener('astro:page-load', () => {
    swarmtroopers?.destroy();
    swarmtroopers = create({ root: 'main', auto: true });
  });
  document.addEventListener('astro:before-swap', () => {
    swarmtroopers?.destroy();
    swarmtroopers = undefined;
  });
</script>`)}
<p>The <a href="https://docs.astro.build/en/guides/view-transitions/#lifecycle-events" target="_blank" rel="noopener">Astro navigation lifecycle</a> describes when the new document is ready.</p>
<h2 id="angular">Angular</h2>
<p>Initialize after view creation, guard server rendering, and clean up at destruction. In a zone-based application, run the animation outside Angular’s zone to avoid scheduling change detection for each animation frame.</p>
${code('ts', `import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit, Component, NgZone, OnDestroy, PLATFORM_ID, inject,
} from '@angular/core';
import { create, type SwarmTroopers } from 'swarmtroopers';

@Component({ selector: 'app-swarmtroopers', template: '' })
export class SwarmTroopersOverlay implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private platform = inject(PLATFORM_ID);
  private swarmtroopers?: SwarmTroopers;

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platform)) return;
    this.zone.runOutsideAngular(() => {
      this.swarmtroopers = create({ root: 'main', auto: true });
    });
  }

  ngOnDestroy() { this.swarmtroopers?.destroy(); }
}`)}
<p>See <a href="https://angular.dev/guide/components/lifecycle" target="_blank" rel="noopener">Angular lifecycle</a> and <a href="https://angular.dev/api/core/NgZone" target="_blank" rel="noopener">NgZone</a>. With any framework, finish rendering important content first and avoid two animation systems controlling the same element.</p>`
  },
  {
    slug: 'controls', title: 'Quality and controls', group: 'Guides',
    description: 'Respect reader preferences and expose a clear Full, Light, Off choice.',
    body: `
<h2 id="add-controls">Add the built-in controls</h2>
${code('js', `import { create, controls } from 'swarmtroopers';

const swarmtroopers = create({ root: 'main', auto: true });
const panel = controls(swarmtroopers, {
  position: 'bottom-right',
  labels: { title: 'Swarm Troopers', full: 'Full', light: 'Light', off: 'Off' },
});`)}
<p>The helper returns an <code>HTMLElement</code> with three pressed-state buttons. It reads the host theme, synchronizes when quality changes, and registers the panel with <code>swarmtroopers.own()</code>, so <code>destroy()</code> removes it.</p>
${table(['ControlsOptions field', 'Default', 'Meaning'], [
['<code>position</code>', '<code>bottom-left</code>', '<code>bottom-left</code>, <code>bottom-right</code>, <code>top-left</code>, or <code>top-right</code>.'],
['<code>labels</code>', 'swarmtroopers / Full / Light / Off', 'Partial overrides of <code>title</code>, <code>full</code>, <code>light</code>, and <code>off</code>. Labels are not automatically translated.'],
['<code>container</code>', '<code>document.body</code>', 'DOM parent for the panel. Its built-in positioning remains fixed.'],
])}
<p>The canvas <code>zIndex</code> option does not change the controls’ CSS stacking level, which is <code>2147483001</code>. Adapt host CSS if your application requires a different control placement.</p>
<h2 id="quality-resolution">Initial quality resolution</h2>
<ol><li>A valid saved <code>full</code>, <code>light</code>, or <code>off</code> value under <code>storageKey + ':quality'</code> wins.</li><li>Without that preference, <code>prefers-reduced-motion: reduce</code> selects Off.</li><li>Then an explicit quality other than Auto is used.</li><li>Auto selects Light for data-saving connections, four or fewer reported CPU cores, or four or fewer GB of reported device memory. Otherwise it selects Full.</li></ol>
<p>Viewport width alone does not choose Light. Narrow screens separately use smaller pointers and shorter patience. Later system motion changes are resolved the same way while the page is open, when there is no saved manual choice. Explicit reader choices retain precedence.</p>
${table(['Budget', 'Workers', 'Canvas density', 'Result'], [
['Full', '6 by default, plus orchestrator', 'Device pixel ratio capped at 1.5', 'The complete build and inspection experience.'],
['Light', 'At most 3, plus orchestrator', 'Capped at 1', 'Fewer workers and faster gestures.'],
['Off', 'No build overlay', 'No canvas', 'The existing page is immediately available.'],
])}
<h2 id="change-quality">Changing quality</h2>
${code('js', `swarmtroopers.setQuality('light');
swarmtroopers.setQuality('off');   // Completes pending work and removes the canvas.
swarmtroopers.setQuality('full');  // Does not replay content already completed.`)}
<p>The choice persists across reloads when localStorage is available. If storage is blocked, the page still works but the choice is not remembered. Do not continually overwrite a reader’s choice during navigation.</p>
<h2 id="session-scope">Session scope and replay</h2>
<p><code>once: 'session'</code> saves completion under <code>storageKey + ':seen'</code>. It is not automatically keyed by URL. Use a page-specific prefix when different pages should each build once; this also gives each prefix its own quality preference.</p>
${code('js', `const swarmtroopers = create({
  root: 'main', auto: true,
  once: 'session',
  storageKey: 'swarmtroopers:portfolio',
});`)}
<p>For a Replay button, destroy the previous instance and create another with <code>once: false</code>. Keep your chosen configuration in application code rather than accessing internal settings.</p>`
  },
  {
    slug: 'tokens', title: 'Design tokens', group: 'Guides',
    description: 'Show the real token names behind typography, colors, spacing, and corners.',
    body: `
<h2 id="enable-tokens">Enable inspection</h2>
${code('js', `create({
  root: 'main', auto: true, inspect: true,
  plugins: ['tokens'],
});`)}
<p>After a finished element is hovered, the plugin compares its computed style with known tokens. Without <code>inspect: true</code> or construction labels, installing the plugin alone does not make labels visible.</p>
<h2 id="css-tokens">CSS custom properties</h2>
<p>The plugin reads declarations on <code>:root</code> and <code>html</code>, including adopted stylesheets and inline root properties. It infers categories from token names and resolves values through the browser, so CSS aliases, <code>rem</code>, <code>clamp()</code>, and supported color syntax can match actual rendered values.</p>
${code('css', `:root {
  --color-text-primary: #181b20;
  --font-size-title: 2rem;
  --space-card: 1.5rem;
  --radius-card: 0.75rem;
}
.card { padding: var(--space-card); border-radius: var(--radius-card); }
h2 { color: var(--color-text-primary); font-size: var(--font-size-title); }`)}
<p>Cross-origin stylesheets that the browser refuses to expose through CSSOM are skipped. Component-only declarations are not an independent token source. Use the explicit <code>source</code> option when your tokens live elsewhere.</p>
<h2 id="token-options">TokensOptions</h2>
${table(['Field', 'Default', 'Meaning'], [
['<code>source</code>', 'None', 'Extra token object, flat or in the supported DTCG-like structure.'],
['<code>css</code>', '<code>true</code>', 'Read root CSS custom properties; set false for an external-only source.'],
['<code>max</code>', '<code>2</code>', 'Maximum token names in a label.'],
])}
${code('js', `import { create, tokens } from 'swarmtroopers';

create({
  root: 'main', auto: true, inspect: true,
  plugins: [tokens({
    max: 3,
    source: {
      'color.text.primary': '#181b20',
      'font-size.title': '32px',
      'space.card': '24px',
      'radius.card': '12px',
    },
  })],
});`)}
<h2 id="dtcg">Structured sources and aliases</h2>
${code('js', `const source = {
  color: {
    $type: 'color',
    base: { $value: '#4f7bff' },
    action: { $value: '{color.base}' },
  },
  space: {
    card: { $type: 'dimension', $value: { value: 24, unit: 'px' } },
  },
};

const plugin = tokens({ css: false, source });`)}
<p>The parser recognizes <code>$value</code>, inherited <code>$type</code>, string references such as <code>{color.base}</code>, numeric values interpreted as pixels, <code>{ value, unit }</code> dimensions, and color objects with a <code>hex</code> field. Alias resolution follows at most eight reference hops. It is not a general validator or full converter for every DTCG color-space representation; provide CSS color strings or supported values.</p>
<h2 id="matching">What labels report</h2>
<p>Typing tasks match font size and text color. Rules match background or border color. Frames match the top-left corner radius, background, top padding, and top border. Semantic color names are preferred when several names share a value. A missing match falls back to Swarm Troopers’ ordinary size label.</p>
<p>The token index is cached, then invalidated when Swarm Troopers invalidates layout, such as after resize, fonts, or <code>refresh()</code>. Inspection explains computed values; it does not edit your token system.</p>`
  },
  {
    slug: 'localization', title: 'Names and localization', group: 'Guides',
    description: 'Customize agent names, task captions, section names, and bubbles.',
    body: `
<h2 id="locale">Choose a language</h2>
<p>English and French are built in. Swarm Troopers resolves the locale from <code>chat.locale</code> when provided, then the top-level <code>locale</code>, then the document’s <code>lang</code>, and finally English. It lowercases and uses the first two characters, so <code>fr-CA</code> selects French. Unsupported languages fall back to English.</p>
${code('js', `create({
  root: 'main', auto: true,
  locale: 'en',
  names: ['Ada', 'Mia', 'Iris'],
  leadName: 'Swarm Troopers',
  chat: false,
});`)}
<p>Names and task captions work without bubbles. The finale shows the two agents’ name tags and no other text. <code>names: false</code> hides pointer name tags and their attached task captions; it does not change your page content. Worker names come from a supplied pool, not automatic translation. <code>leadName</code> overrides the localized orchestrator name.</p>
<h2 id="chat-options">ChatOptions reference</h2>
${table(['Field', 'Meaning'], [
['<code>locale</code>', 'Locale override for the text pack.'],
['<code>lines</code>', 'Partial map of speech keys to arrays of strings. Keys: <code>plan</code>, <code>ready</code>, <code>reply</code>, <code>rush</code>, <code>done</code>.'],
['<code>subjects</code>', 'Partial words for <code>header</code>, <code>footer</code>, and fallback <code>part</code>.'],
['<code>tasks</code>', 'Partial verb templates for <code>type</code>, <code>frame</code>, <code>rule</code>, <code>stamp</code>, and fallback <code>other</code>.'],
['<code>kinds</code>', 'Partial words for <code>title</code>, <code>text</code>, <code>label</code>, <code>item</code>, <code>button</code>, <code>link</code>, <code>image</code>, <code>card</code>, <code>line</code>, <code>list</code>, and <code>block</code>.'],
['<code>bubbles</code>', 'Defaults to true for an options object; false keeps overrides while suppressing speech.'],
])}
<h2 id="templates">Text templates</h2>
<p>Speech templates use <code>{s}</code> for the section name and <code>{n}</code> for worker count. Task templates use <code>{k}</code> for the element kind. Use each placeholder once per template; replacement is simple rather than a general templating engine.</p>
${code('js', `create({
  root: 'main', auto: true,
  chat: {
    lines: { done: ['All set.'] },
    tasks: { type: 'Writing {k}', frame: 'Placing {k}' },
    kinds: { title: 'the headline' },
  },
});`)}
<p>Each array is a set of choices for speech; one is picked at random. The <code>done</code> line is the orchestrator’s closing bubble when bubbles are on and the finale does not play, for example with <code>finale: false</code>. Add <code>bubbles: false</code> to keep the task overrides while suppressing speech. An empty speech array suppresses that key. Custom section labels and actual page headings remain exactly the text you authored.</p>
<h2 id="readability">Keep it readable</h2>
<p>Orchestrator bubbles are off by default. Enable them with <code>chat: true</code> or an options object when they help explain a demonstration. Keep captions short: long labels are fitted to the viewport, and narrow screens limit concurrent captions to avoid a cluster of text.</p>`
  },
  {
    slug: 'extending', title: 'Custom tools and plugins', group: 'Reference',
    description: 'Add a purposeful gesture or supply annotations from your own system.',
    body: `
<h2 id="custom-tool">Register a generator tool</h2>
<p>A tool is a synchronous generator. Each <code>yield</code> waits for the next frame and receives elapsed seconds adjusted by Swarm Troopers’ pacing. Register the tool before creating the instance or collecting its annotated elements.</p>
${code('js', `import { create, defineTool } from 'swarmtroopers';

defineTool('spotlight', function* (c) {
  c.shape('cross');
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }, { width: 40 });
  yield* c.click();
  c.reveal.pop();
  c.shape('arrow');
});

create({ root: 'main' });`)}
${code('html', `<div data-swarmtroopers="spotlight">This element uses the registered gesture.</div>`)}
<p>When a generator returns, Swarm Troopers completes the task and restores its prior clip-path value and priority. Tool factories and generator steps are isolated: a failed task is revealed with a diagnostic. Cancellation failures cannot interrupt host cleanup. An unrecoverable renderer failure destroys the instance and restores the host. Use <code>try/finally</code> to release held pointer state and close long-lived annotations when a generator is interrupted.</p>
<h2 id="tool-context">ToolContext reference</h2>
${table(['Member', 'Purpose'], [
['<code>el</code>, <code>task</code>, <code>agent</code>', 'The element, current Task, and Agent for this gesture. Treat scheduler state as read-only context.'],
['<code>random</code>', 'Seeded random helper with <code>next()</code>, <code>range(lo, hi)</code>, <code>chance(p)</code>, and <code>normal(mean?, sd?)</code>.'],
['<code>rect()</code>', 'Current element rectangle <code>{ x, y, w, h }</code> in document CSS pixels.'],
['<code>sourceRect()</code>', 'Previous repeat item’s rectangle, or null.'],
['<code>move(pointOrFunction, options?)</code>', 'Movement generator. Options: target <code>width</code>, <code>drag</code> boolean, and <code>onStep</code> callback. A function tracks a moving destination.'],
['<code>wait(seconds)</code>', 'Wait generator. Use <code>yield*</code>.'],
['<code>click()</code>', 'Press-feedback generator. It does not dispatch a real click to your page.'],
['<code>shape(value)</code>', 'Choose <code>arrow</code>, <code>beam</code>, <code>cross</code>, <code>stamp</code>, or <code>hand</code>.'],
['<code>hold(boolean)</code>', 'Set the held-down pointer appearance.'],
['<code>dim(boolean)</code>', 'Dim the pointer, as when typing.'],
['<code>mark(init)</code>', 'Create a canvas annotation. Its returned <code>done()</code> starts removal.'],
['<code>label()</code>', 'Ask plugins for a label, with size fallback. Construction labels must be enabled.'],
['<code>text()</code>', 'Measured TextGeo or null: text sequence, pieces, lines, bands, dimensions, and padding.'],
['<code>reveal.begin(clip?)</code>', 'Remove the pending class, optionally setting an initial CSS clip-path.'],
['<code>reveal.clip(value)</code>', 'Update the element’s clip-path.'],
['<code>reveal.sweep(x, y)</code>', 'Show the top-left part of the element, <code>x</code> and <code>y</code> from 0 to 1, with a soft edge where the mask allows it.'],
['<code>reveal.end()</code>', 'Restore the original inline clip-path and remove the soft edge.'],
['<code>reveal.pop()</code>', 'Reveal immediately with the short completion fade and mark the task done.'],
['<code>reveal.settle()</code>', 'Like <code>pop()</code>, but the element drops into place with a small bounce.'],
])}
<p><code>ToolGen</code> is <code>Generator&lt;void, void, number&gt;</code>. A <code>Point</code> has <code>x</code> and <code>y</code>; a <code>Rect</code> additionally has <code>w</code> and <code>h</code>. Do not replace a generator with an async function or use timers to mutate an element after the task has finished.</p>
<h2 id="annotations">AnnotationInit</h2>
<p>Every annotation has a required <code>kind</code>, optional <code>color</code>, optional <code>ttl</code> in seconds, and optional <code>label</code>. Color defaults to the agent’s color. Lifetime defaults to infinity, so explicitly call the returned annotation’s <code>done()</code> for temporary marks.</p>
${table(['Kind', 'Geometry callbacks'], [
['<code>drag</code>, <code>ghost</code>, <code>select</code>, <code>zone</code>', '<code>rect: () =&gt; Rect</code>; select can display a label.'],
['<code>line</code>, <code>caret</code>', '<code>a: () =&gt; Point</code> and <code>b: () =&gt; Point</code>.'],
['<code>ripple</code>, <code>spark</code>', '<code>a: () =&gt; Point</code>; use a finite lifetime for the effect.'],
])}
<p>Callbacks keep geometry aligned with scrolling and moving content. The public configuration accepts geometry callbacks; the returned annotation’s age, fade state, and closed flag belong to the renderer.</p>
<h2 id="plugins">SwarmTroopersPlugin</h2>
${code('ts', `interface SwarmTroopersPlugin {
  name: string;
  setup?(swarmtroopers: SwarmTroopers): void | (() => void);
  label?(el: SwarmTroopersElement, tool: string): string | null | undefined;
  invalidate?(): void;
}`)}
${code('js', `const componentNames = {
  name: 'component-names',
  label(element) {
    return element.getAttribute('data-component');
  },
};

create({
  root: 'main', auto: true, inspect: true,
  plugins: [componentNames, 'tokens'],
});`)}
<p><code>setup</code> runs during construction before initial collection. Label providers are checked in order; the first nonempty label wins. Returning null or undefined allows the next provider or default label. <code>invalidate</code> clears plugin caches when Swarm Troopers invalidates geometry. A setup function may return a cleanup callback, called on destroy and initialization rollback. Cleanup and invalidation exceptions are isolated. Register DOM additions with <code>swarmtroopers.own()</code>; use the setup cleanup to release external subscriptions.</p>`
  },
  {
    slug: 'accessibility', title: 'Accessibility and performance', group: 'Guides',
    description: 'Keep content available and treat motion as a progressive enhancement.',
    body: `
<h2 id="content-first">Content first</h2>
<p>Write complete semantic HTML before loading Swarm Troopers. The overlay canvas is decorative and marked <code>aria-hidden</code>; it never intercepts the pointer. Text remains in the DOM, while visual reveals use opacity and clip-path without moving the underlying layout.</p>
<p>Do not treat DOM presence as a complete accessibility audit. Swarm Troopers temporarily makes pending elements transparent and non-pointer-interactive. Keep essential navigation, form controls, critical calls to action, and content needed for an immediate task outside the effect. Auto mode leaves controls and their enclosing boxes visible. A focusin handler immediately settles an explicitly annotated focused task and its dependencies. Printing settles reveals and hides decorative UI. The native document must remain useful with JavaScript disabled.</p>
<h2 id="motion-preferences">Reader preferences</h2>
<p>Without a saved quality choice, reduced motion selects Off at construction. A saved explicit reader choice takes precedence. Always offer the controls when motion is decorative. Test Off and reduced motion separately: both should leave content visible without an overlay, and the choice should survive a reload when storage is allowed.</p>
<p>With no saved manual choice, a running instance follows later system motion changes without persisting them, whatever the <code>quality</code> option. Explicit reader choices take precedence. Turning motion back on does not replay completed content.</p>
<h2 id="largest-contentful-paint">Loading and Largest Contentful Paint</h2>
<p>Hiding a hero until Swarm Troopers reveals it can postpone Largest Contentful Paint. Exclude that hero with <code>data-swarmtroopers-skip</code>, or limit Swarm Troopers to a dedicated demonstration below it. Avoid scroll-triggered hiding for content that must be visible on first paint.</p>
<p>The preload snippet avoids flashing content before the animation starts, but that tradeoff is deliberate. It is opt-in, belongs in head, uses explicit <code>data-swarmtroopers-preload</code> markers, and needs its safety timer. It must not hide excluded or critical content. Never replace it with a permanent CSS rule that hides the page when the script fails.</p>
<h2 id="rendering-budget">Rendering budget</h2>
<p>Swarm Troopers uses one fixed canvas. Full mode caps device pixel ratio at 1.5; Light caps it at 1. The loop sleeps when nothing moves and pauses updates in background tabs. Layout rectangles and token lookups are cached and invalidated when necessary.</p>
<p>Use a focused root, a modest worker count, and the task limit on large pages. The core has no finale artwork; the optional full profile embeds two SVG hands. Decode is skipped for disabled finales and inspection-only instances; measure your actual built output with <code>npm run size</code> rather than assuming a historical size. Profile the real page on target devices; desktop emulation cannot establish performance on a physical phone.</p>
<h2 id="content-security-policy">Content Security Policy</h2>
<p>Serve the library from a domain allowed by <code>script-src</code>. Give inline initialization and the preload script/style valid nonces or hashes, or use external initialization and omit the preload. The self-hosted script path is under your control.</p>
<p>Styles normally use constructable stylesheets. When those are unavailable, Swarm Troopers falls back to a style element, which a strict <code>style-src</code> policy can block. If neither stylesheet path is available, Swarm Troopers uses visible quality Off instead of enrolling hidden tasks. The preload style also needs to satisfy that policy.</p>
<p>The high-five artwork and dock mark are embedded <code>data:</code> image URLs. Allow <code>data:</code> in <code>img-src</code> if those images should display. When decoding is blocked or fails, the finale uses its vector fallback and the dock keeps its text label. No remote image host is required by the library.</p>
<h2 id="existing-animations">Existing animations and browser checks</h2>
<p>Choose one owner for an element’s visibility and clip-path. Auto mode skips initially invisible elements, but two systems controlling the same visible element can still conflict. Remove the other reveal animation or exclude the element from Swarm Troopers.</p>
<p>The implementation uses Canvas 2D, Path2D, CSS clip-path, generators, and modern observer APIs. An absent IntersectionObserver makes tasks count as visible; ResizeObserver is optional. Validate your supported browser matrix, fonts, nested scrolling, touch behavior, and strict CSP on the site itself. Shadow-tree roots and transformed documents that invalidate viewport coordinates fall back to visible quality Off with a diagnostic. Overlapping instance roots are refused. Portability and real React Strict Mode/navigation fixtures are tested in Chrome, Firefox and Playwright WebKit. The full landing/demo suite runs in Chrome. Physical devices, Safari itself, assistive technologies and other framework runtimes still require validation. Include 320px layouts, no-JavaScript rendering, mid-build <code>destroy()</code>, and route changes in your checks.</p>`
  },
  {
    slug: 'troubleshooting', title: 'Troubleshooting', group: 'Guides',
    description: 'Find why an effect is skipped, content stays hidden, or labels are missing.',
    body: `
<h2 id="no-animation">Nothing animates</h2>
<ol><li>Check <code>swarmtroopers.quality</code>. A saved Off choice takes precedence over <code>quality: 'full'</code>.</li><li>Check reduced motion and the <code>once: 'session'</code> completion key.</li><li>Check selection: annotations are required unless <code>auto: true</code>.</li><li>Confirm the script loaded, the root exists when you create Swarm Troopers, and manual instances receive <code>start()</code>.</li><li>Auto mode skips initially hidden, fixed, sticky, and off-canvas content. Confirm the element is eligible.</li></ol>
${code('js', `console.log(swarmtroopers.quality, swarmtroopers.stats);
console.log(localStorage.getItem('swarmtroopers:quality'));
console.log(sessionStorage.getItem('swarmtroopers:seen'));`)}
<p>For a controlled development reset, remove only the matching prefix’s keys and reload. Do not clear all of a visitor’s storage.</p>
${code('js', `localStorage.removeItem('swarmtroopers:quality');
sessionStorage.removeItem('swarmtroopers:seen');
location.reload();`)}
<h2 id="hidden-content">Content stays hidden or flashes</h2>
<p>Match the preload selector to the actual root, keep the 2.5-second safety timer, and inspect script errors. A missing explicit root is rejected before any content is hidden. Renderer startup failure leaves the page visible in Off mode. An annotated root itself is not a task: annotate descendants.</p>
<p>Call <code>swarmtroopers.finish()</code> to reveal collected tasks now, or <code>swarmtroopers.destroy()</code> to remove the instance’s effects and controls. If another library also hides the element, removing Swarm Troopers cannot override that library’s styles.</p>
<h2 id="missing-labels">Inspection or token labels are missing</h2>
<p>Set <code>inspect: true</code>, finish the element’s build, and hover it with a mouse pointer. Construction labels additionally need <code>labels: true</code> and are suppressed on narrow screens. Quality Off has no overlay. Make sure tokens are declared on readable root stylesheets, use recognizable names, or pass a supported explicit source. No token match falls back to dimensions rather than inventing a token.</p>
<h2 id="content-updates">New content or navigation is not built</h2>
<p>Call <code>refresh()</code> after new elements mount and become visible. It removes disconnected tasks and discovers unknown eligible elements; it does not re-run known elements, detect in-place text updates, or update every construction option. Destroy and recreate after full view replacement, and keep one instance per view.</p>
${code('js', `// After your application has mounted new content:
swarmtroopers.refresh();

// To replay an existing root:
swarmtroopers.destroy();
const replacement = create({ root: 'main', auto: true });`)}
<p>Returning from Off to Full also does not replay completed content. A page reloaded at a mid-page scroll position starts near the reader; content above can build when the reader scrolls back, while scrolled-past pending tasks can reveal immediately.</p>
<h2 id="framework-duplicates">There are duplicate cursors or control panels</h2>
<p>Check effect cleanup, persistent layout mounts, route hooks, and whether both a JSON initializer and a custom element create an instance. Do not create Swarm Troopers on each render. Framework development remounts should destroy the first instance before creating the next. Swarm Troopers refuses overlapping roots rather than allowing two instances to own the same content.</p>
<h2 id="csp-and-assets">Images, script, or styles are blocked</h2>
<p>Inspect the browser’s CSP messages. Allow your chosen script origin and required nonces or hashes. Embedded artwork needs <code>img-src data:</code>; if blocked it falls back, rather than downloading another image. ES modules also need their adjacent shared chunks. See <a href="accessibility.html#content-security-policy">the CSP guide</a>.</p>
<h2 id="unexpected-text">The text or language is unexpected</h2>
<p>Check the document’s <code>lang</code>, <code>locale</code>, and <code>chat.locale</code> override. Chat options can also change task captions. Quality-control labels are independently configurable; they do not use the chat locale. The custom element needs two or more comma-separated names to replace its pool.</p>
`
  },
  {
    slug: 'examples', title: 'Working examples', group: 'Getting started',
    description: 'Compare real integrations and copy a focused starting point.',
    body: `
<h2 id="full-page-examples">Explore complete pages</h2>
<ul><li><a href="../index.html#playground" target="_blank" rel="noopener">The live playground</a> on the landing page runs the library in four tabs: website, gestures, high five, and full page.</li><li><a href="../try.html" target="_blank" rel="noopener">The full product-page build</a> runs a complete page from top to bottom.</li><li><a href="../demo/index.html" target="_blank" rel="noopener">The everyday-website demo</a> combines automatic scanning, annotations, four tools, tokens, controls, and replay.</li><li><a href="../demo/hugo.html" target="_blank" rel="noopener">The portfolio example</a> demonstrates a darker host design with the same overlay and shared Swarm Troopers header.</li></ul>
<p>Use Replay to create a fresh instance. Try Off, reload the page to check the saved preference, and inspect a heading after completion. The host page remains its own design; Swarm Troopers does not require a component library.</p>
<h2 id="focused-tools">Watch the four tools</h2>
<p>This compact example uses the actual built library, not a recording. It can complete inside its frame; if reduced motion is enabled, the finished content appears without the animation.</p>
<iframe data-doc-example src="../site-demo.html?scene=tools" title="Live Swarm Troopers example showing typing, framing, rules and stamped items" height="480" loading="lazy"></iframe>
<p><a href="../site-demo.html?scene=tools" target="_blank" rel="noopener">Open the tools example on its own</a>.</p>
<h2 id="annotated-starter">A small annotated starter</h2>
${code('html', `<main id="showcase">
  <section data-swarmtroopers-section="An introduction">
    <h1 data-swarmtroopers="type">Make room for good ideas.</h1>
    <article data-swarmtroopers="frame">A thoughtfully framed card.</article>
    <hr data-swarmtroopers="rule">
    <ul data-swarmtroopers="repeat">
      <li>One idea</li><li>Another idea</li><li>Something clicks</li>
    </ul>
  </section>
</main>
<script src="https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{"root":"#showcase","inspect":true,"controls":true}'></script>`)}
<p>Add your normal typography, spacing, card surfaces, and list styling. The annotations choose tools; they do not replace the host design.</p>
<h2 id="manual-starter">Start on an intentional action</h2>
<p>Manual mode collects and hides selected elements before starting. Keep the start button outside the root, avoid hiding essential content, and consider whether a static preview is a better initial state for your audience.</p>
${code('js', `const swarmtroopers = create({
  root: '#showcase',
  auto: true,
  trigger: 'manual',
});

document.querySelector('#start-demo').addEventListener('click', () => {
  swarmtroopers.start();
}, { once: true });`)}
<h2 id="completion-example">Completion behavior</h2>
<p>The closing clap plays after a natural build with at least one spawned agent, where the orchestrator stands; the center of the viewport is only a fallback. Two emoji-sized hands (76px, 64px on narrow screens) swing in, slap, and rebound once. A short burst of strokes in the two agents’ colors marks the contact, and each hand has its agent’s name tag under it: the last worker on the left, the orchestrator on the right. There is no panel or veil, so the page stays fully visible, and the clap never catches the pointer.</p>
<p><code>finale: false</code> disables it; <code>finish()</code> reveals content without playing it. A deliberate wheel, touch, click, or key dismisses it after its initial half-second. It clears automatically after 3.54 seconds.</p>
<p><a href="../site-demo.html?scene=finale" target="_blank" rel="noopener">Try the compact completion example</a>. This is a behavior reference, not a required section of your website.</p>`
  },
];
