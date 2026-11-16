const frame = document.querySelector('#live-preview');
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
const status = document.querySelector('#preview-status');
const sceneDescriptions = {
  page: 'Your HTML, built by the agents.',
  tools: 'Typing, framing, drawing, stamping. Real Swarm Troopers gestures.',
  finale: 'A tiny build. A well-earned high five.',
};
const sceneNames = { page: 'website', tools: 'gestures', finale: 'high five' };
let scene = 'page';
let previewStarted = false;

/* Plan tree: every row is driven by events the real library sends from the preview frame. */
const rows = Object.fromEntries([...document.querySelectorAll('#plan [data-row]')].map((li) => [li.dataset.row, li]));
const tools = ['type', 'frame', 'rule', 'stamp'];
const runName = document.querySelector('#run-name');
const runState = document.querySelector('#run-state');
const runSteps = document.querySelector('#run-steps');
const runTime = document.querySelector('#run-time');
const closingRun = document.querySelector('#closing-run');
const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let run = null;
let ticker = 0;

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
function setRow(key, state, what, time) {
  const li = rows[key];
  li.dataset.s = state;
  li.querySelector('.g').textContent = state === 'done' ? '✓' : state === 'queued' ? '○' : spin[2];
  if (what !== undefined) li.querySelector('.what').textContent = what;
  if (time !== undefined) li.querySelector('.t').textContent = time;
}
function stopTicker() {
  clearInterval(ticker);
  ticker = 0;
}
function resetPlan() {
  stopTicker();
  run = null;
  runName.textContent = `run · ${sceneNames[scene]}`;
  runState.textContent = 'queued';
  runSteps.textContent = '0/0';
  runTime.textContent = '0.0s';
  setRow('plan', 'queued', 'eli · survey sections', '–');
  tools.forEach((tool) => { rows[tool].hidden = false; setRow(tool, 'queued', '–', '–'); });
  setRow('done', 'queued', 'eli · hand back', '–');
}
function toolLabel(tool) {
  return `${run.count[tool]}/${Math.max(run.total[tool], run.count[tool])}`;
}
function startRun(data) {
  stopTicker();
  run = { t0: performance.now(), total: { type: 0, frame: 0, rule: 0, stamp: 0, ...data.tools }, count: { type: 0, frame: 0, rule: 0, stamp: 0 }, tasks: data.tasks, done: 0, frame: 0 };
  runState.textContent = 'running';
  runSteps.textContent = `0/${run.tasks}`;
  setRow('plan', 'done', `eli · ${run.tasks} steps`, '0.0s');
  tools.forEach((tool) => {
    rows[tool].hidden = run.total[tool] === 0;
    setRow(tool, 'queued', toolLabel(tool), '–');
  });
  if (!reduce.matches) ticker = setInterval(tick, 80);
}
function tick() {
  if (!run) return;
  const elapsed = seconds(performance.now() - run.t0);
  const glyph = spin[++run.frame % spin.length];
  runTime.textContent = elapsed;
  Object.values(rows).forEach((li) => {
    if (li.dataset.s !== 'running') return;
    li.querySelector('.g').textContent = glyph;
    li.querySelector('.t').textContent = elapsed;
  });
}
function taskDone(data) {
  if (!run) return;
  run.done = data.done;
  run.tasks = Math.max(run.tasks, data.tasks);
  runSteps.textContent = `${run.done}/${run.tasks}`;
  const tool = data.tool;
  if (tools.includes(tool)) {
    run.count[tool]++;
    rows[tool].hidden = false;
    const finished = run.count[tool] >= run.total[tool];
    setRow(tool, finished ? 'done' : 'running', toolLabel(tool), finished ? seconds(performance.now() - run.t0) : undefined);
  }
  if (run.done >= run.tasks) setRow('done', 'running', 'eli · hand back');
}
function finishRun(stats = {}) {
  stopTicker();
  const tasks = stats.tasks ?? run?.tasks ?? 0;
  const duration = stats.duration ?? (run ? (performance.now() - run.t0) / 1000 : 0);
  tools.forEach((tool) => {
    if (run) run.total[tool] = run.count[tool];
    if (rows[tool].dataset.s !== 'done') setRow(tool, 'done', run ? toolLabel(tool) : 'built', rows[tool].querySelector('.t').textContent === '–' ? '0.0s' : undefined);
    if (run && run.count[tool] === 0) rows[tool].hidden = true;
  });
  if (rows.plan.dataset.s !== 'done') setRow('plan', 'done', `eli · ${tasks} steps`, '0.0s');
  setRow('done', 'done', 'eli · hand back', `${duration.toFixed(1)}s`);
  runState.textContent = 'built';
  runSteps.textContent = `${tasks}/${tasks}`;
  runTime.textContent = `${duration.toFixed(1)}s`;
  if (stats.agents) closingRun.textContent = `run complete · ${tasks} steps · ${stats.agents} agents · ${duration.toFixed(1)}s`;
  run = null;
}

frame.addEventListener('load', () => {
  if (frame.hasAttribute('src')) frame.parentElement.dataset.loaded = '';
});

const startPreview = () => {
  if (previewStarted) return;
  previewStarted = true;
  frame.src = frame.dataset.src;
};

const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.65)) {
    startPreview();
    observer.disconnect();
  }
}, { threshold: 0.65 }) : null;
if (observer) observer.observe(frame);
else startPreview();

function replay(next = scene) {
  scene = next;
  previewStarted = true;
  observer?.disconnect();
  resetPlan();
  sceneButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scene === scene)));
  frame.title = `Live Swarm Troopers demonstration: ${sceneDescriptions[scene]}`;
  frame.src = `site-demo.html?scene=${scene}&replay=${Date.now()}`;
  status.textContent = sceneDescriptions[scene];
  document.querySelector('#playground').scrollIntoView({ behavior: 'instant', block: 'nearest' });
}

sceneButtons.forEach((button) => button.addEventListener('click', () => replay(button.dataset.scene)));
document.querySelector('#replay').addEventListener('click', () => replay());
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'swarmtroopers-demo' || event.data.scene !== scene) return;
  const { state } = event.data;
  if (state === 'building') {
    startRun(event.data);
    status.textContent = `Agents at work. ${sceneDescriptions[scene]}`;
  }
  if (state === 'task') taskDone(event.data);
  if (state === 'done') {
    finishRun(event.data.stats);
    status.textContent = 'Built. Replay it, or hover the page to inspect the details.';
  }
  if (state === 'reduced') {
    finishRun({ tasks: event.data.tasks, duration: 0 });
    status.textContent = 'Reduced motion is on. The page is already built.';
  }
  if (state === 'unavailable') {
    stopTicker();
    runState.textContent = 'failed';
    status.textContent = 'The preview could not start. The original content is still here.';
  }
});

const snippets = {
  script: `<!-- No build step: pinned CDN, or self-host from node_modules. -->
<script
  src="https://unpkg.com/swarmtroopers@0.4.0/dist/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{
    "root": "main",
    "auto": true,
    "controls": true
  }'
><\/script>`,
  module: `// npm i swarmtroopers
import { create, controls } from 'swarmtroopers';

const swarmtroopers = create({
  root: 'main',
  auto: true,
  inspect: true,
});

controls(swarmtroopers);`,
};
const code = document.querySelector('#install-code');
const copyButton = document.querySelector('#copy-code');
const copyStatus = document.querySelector('#copy-status');
let install = 'script';
const installNotes = {
  script: 'Pinned CDN, no build step. Or copy the file from node_modules and self-host.',
  module: 'npm i swarmtroopers. Create on mount. Call swarmtroopers.destroy() when the view unmounts.',
};

document.querySelectorAll('[data-install]').forEach((button) => {
  button.addEventListener('click', () => {
    install = button.dataset.install;
    document.querySelectorAll('[data-install]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
    code.textContent = snippets[install];
    copyStatus.textContent = installNotes[install];
    copyButton.querySelector('span').textContent = 'copy';
  });
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(snippets[install]);
    copyButton.querySelector('span').textContent = 'copied';
    copyStatus.textContent = 'Copied. Paste it before the closing body tag.';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    code.closest('pre').focus();
    copyStatus.textContent = 'Code selected. Press Ctrl+C or ⌘C to copy.';
  }
});
