import type {
  SwarmTroopersElement,
  SwarmTroopersEventMap,
  SwarmTroopersOptions,
  SwarmTroopersPlugin,
  SwarmTroopersStats,
  PaletteSpec,
  Point,
  Quality,
  QualitySetting,
  Rect,
  Trigger,
} from './types.js';
import type { Agent, Section, Task } from './model.js';
import { Emitter, clamp, debounce, rng, storage, type Rng } from './util.js';
import { persona, planMove, pointOn, type MoveOpts } from './motion.js';
import { buildPalette, pageBackground, relativeLuminance, type RGB } from './palette.js';
import { scan } from './scan.js';
import { byPriority, pickTask } from './scheduler.js';
import { FINALE_END, FINALE_OUT, Overlay, type Annotation, type AnnotationInit, type Finale, type OverlayStyle } from './overlay.js';
import { TOOLS, type ToolContext, type ToolGen } from './tools.js';
import { measureText, type TextGeo } from './text.js';
import { injectStyles, releaseStyles } from './styles.js';
import { resolveRoot, validateOptions } from './options.js';
import { tokens } from './plugins/tokens.js';
import {
  NAMES,
  chatPack,
  fill,
  kindOf,
  sectionName,
  taskText,
  type ChatKey,
  type ChatLines,
  type ChatOptions,
  type Kind,
  type Subjects,
  type TaskVerbs,
} from './chat.js';

/**
 * Rendering budgets. `max` counts workers; the orchestrator comes on top.
 * "light" sends fewer workers on a 1× canvas and lets them work faster.
 */
const PROFILES = {
  full: { max: 6, squad: 3, dprCap: 1.5, tempo: 0.9 },
  light: { max: 3, squad: 2, dprCap: 1, tempo: 1.15 },
} as const;

/** Parts of a page a squad is sent to. The outermost match wins, so cards inside a section stay in it. */
const SECTION = 'section, header, footer, article, aside, nav, [data-swarmtroopers-section]';
const ACTIVE_ROOTS = new Map<Element, SwarmTroopers>();
/** Width of the soft edge of a frame or rule sweep, in pixels. */
const FEATHER = 26;
const MASK_PROPS = ['mask-image', '-webkit-mask-image', 'mask-repeat', '-webkit-mask-repeat', 'mask-composite', '-webkit-mask-composite'];
const SOFT_MASK = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && (CSS.supports('mask-composite', 'intersect') || CSS.supports('-webkit-mask-composite', 'source-in'));

interface Settings {
  selector: string;
  auto: boolean;
  trigger: Trigger;
  quality: QualitySetting;
  max?: number;
  speed: number;
  palette?: string[] | PaletteSpec;
  inspect: boolean;
  labels: boolean;
  once: false | 'session';
  maxTasks: number;
  zIndex: number;
  storageKey: string;
  names: boolean | string[];
  finale: boolean;
  locale?: string;
  leadName?: string;
  scale?: number;
  patience?: number;
}

export class SwarmTroopers {
  readonly root: Element;
  /** Speed multiplier applied to every gesture, recomputed each frame from the backlog. */
  tempo = 1;

  private s: Settings;
  private q: Quality;
  private stylesOwned = false;
  private unsupported = false;
  private pluginCleanups: Array<() => void> = [];
  private annotationOwners = new WeakMap<Annotation, Agent>();
  private taskSeq = 0;
  private sectionSeq = 0;
  private skipBuild = false;
  private plugins: SwarmTroopersPlugin[];
  private tasks: Task[] = [];
  private sections: Section[] = [];
  private sectionByKey = new Map<unknown, Section>();
  private byEl = new WeakMap<Element, Task>();
  /** Built elements retired while hidden (an inactive tab panel): shown again, they come back finished, not rebuilt. */
  private built = new WeakSet<Element>();
  private agents: Agent[] = [];
  private lead: Agent | null = null;
  /** Elements wearing our soft-edge mask, to take it off when their sweep ends or is cut short. */
  private masked = new WeakSet<Element>();
  /** Freshly built elements the orchestrator has not looked over yet, newest last. */
  private review: Task[] = [];
  private anns: Annotation[] = [];
  private overlay: Overlay | null = null;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private events = new Emitter<SwarmTroopersEventMap>();
  private r: Rng = rng();
  private bg: RGB = [255, 255, 255];
  private halo = 'rgb(255, 255, 255)';
  private ink = 'rgb(20, 20, 20)';
  private palette: string[] = ['#7f7f7f'];
  private raf = 0;
  private running = false;
  private last = 0;
  private clock = 0;
  private started = false;
  private paused = false;
  private destroyed = false;
  private finished = false;
  private seq = 0;
  private spawned = 0;
  private doneCount = 0;
  private t0 = 0;
  private layout = 0;
  private geos = new WeakMap<Element, { v: number; geo: TextGeo | null }>();
  private rects = new Map<Element, Rect>();
  private sx = 0;
  private sy = 0;
  private pointer: Element | null = null;
  /** Hover candidate, since when, and the element handed to the orchestrator. */
  private insp: { el: SwarmTroopersElement | null; since: number; want: SwarmTroopersElement | null } = { el: null, since: 0, want: null };
  private owned: Element[] = [];
  private unlisten: Array<() => void> = [];
  private invalidateSoon = debounce(() => this.invalidate(), 120);
  private look: OverlayStyle = { halo: '#fff', ink: '#111', sans: 'system-ui, sans-serif', scale: 1.2 };
  private chat: { lines: ChatLines; subjects: Subjects } | null = null;
  private subjects: Subjects = chatPack().subjects;
  private leadName = 'Orchestrator';
  private words: { tasks: TaskVerbs; kinds: Record<Kind, string> } = chatPack();
  /** Last worker seen at work, who shares the final high five with the orchestrator. */
  private lastWorker: { name: string; color: string } | null = null;
  /** The closing high five, drawn over the page once everything is built. */
  private fin: Finale | null = null;
  private doneText = '';
  private summary = '';
  private queue: Array<{ a: Agent; text: string; at: number; until: number; overlap: boolean }> = [];

  constructor(options: SwarmTroopersOptions = {}) {
    validateOptions(options);
    this.root = resolveRoot(options.root);
    if ([...ACTIVE_ROOTS.keys()].some(root => root === this.root || root.contains(this.root) || this.root.contains(root))) throw new Error('[swarmtroopers] this region already has an active instance');
    this.root.querySelector(options.selector ?? '[data-swarmtroopers]');
    this.unsupported = this.root.ownerDocument !== document || this.root.getRootNode() !== document;
    this.s = {
      selector: options.selector ?? '[data-swarmtroopers]',
      auto: options.auto ?? false,
      trigger: options.trigger ?? 'immediate',
      quality: options.quality ?? 'auto',
      max: options.agents?.max,
      speed: options.speed ?? 1,
      palette: options.palette,
      inspect: options.inspect ?? false,
      labels: options.labels ?? false,
      once: options.once ?? false,
      maxTasks: options.maxTasks ?? 400,
      zIndex: options.zIndex ?? 2147483000,
      storageKey: options.storageKey ?? 'swarmtroopers',
      names: options.names ?? true,
      finale: options.finale ?? true,
      locale: options.locale,
      leadName: options.leadName,
      scale: options.scale,
      patience: options.patience,
    };
    this.plugins = (options.plugins ?? []).map((p) => (p === 'tokens' ? tokens() : p));
    this.q = this.unsupported ? 'off' : this.resolveQuality();
    ACTIVE_ROOTS.set(this.root, this);
    try {
      this.stylesOwned = true;
      if (!injectStyles()) {
        this.unsupported = true;
        this.q = 'off';
        console.warn('[swarmtroopers] styles unavailable; content remains visible');
      }
      this.paint(options.chat ?? false);
      for (const p of this.plugins) {
        const cleanup = p.setup?.(this);
        if (typeof cleanup === 'function') this.pluginCleanups.push(cleanup);
      }
      if (this.root.getRootNode() !== document) console.warn('[swarmtroopers] this root is outside the supported document; its content remains visible');
      this.init();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  /** Current rendering budget. */
  get quality(): Quality {
    return this.q;
  }

  get stats(): SwarmTroopersStats {
    return { tasks: this.tasks.length, done: this.doneCount, agents: this.spawned, active: this.agents.length };
  }

  /** Colours read from the page, handy to style UI placed around the troopers. */
  get theme(): { background: string; text: string; rgb: Readonly<RGB>; palette: readonly string[] } {
    return { background: this.halo, text: this.ink, rgb: this.bg, palette: this.palette };
  }

  on<K extends keyof SwarmTroopersEventMap>(type: K, fn: (payload: SwarmTroopersEventMap[K]) => void): () => void {
    return this.events.on(type, fn);
  }

  off<K extends keyof SwarmTroopersEventMap>(type: K, fn: (payload: SwarmTroopersEventMap[K]) => void): void {
    this.events.off(type, fn);
  }

  /** Starts the build. Called for you unless trigger is "manual". */
  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.t0 = performance.now();
    this.events.emit('start', { tasks: this.tasks.length });
    this.wake();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.wake();
  }

  /** Shows everything at once and sends the agents away. */
  finish(): void {
    if (this.destroyed) return;
    for (const a of this.agents) this.cancelJob(a);
    this.agents.length = 0;
    this.lead = null;
    this.fin = null;
    this.anns.length = 0;
    this.queue.length = 0;
    for (const t of this.tasks) if (t.state !== 'done') this.complete(t);
    for (const sec of this.sections) sec.zone = null;
    this.started = true;
    this.wrapUp(false);
    this.wake();
  }

  /** Picks up elements added to the page since the troopers started (client-side navigation, lazy content). */
  refresh(): void {
    if (this.destroyed) return;
    const build = this.q !== 'off' && !this.skipBuild;
    this.prune();
    this.sweepStale();
    this.collect(build);
    if (build && this.tasks.some(t => t.state === 'pending')) {
      this.finished = false;
      this.fin = null;
    }
    this.invalidate();
  }

  setQuality(q: Quality): void {
    if (this.destroyed) return;
    if (!['full', 'light', 'off'].includes(q)) throw new TypeError('[swarmtroopers] invalid quality');
    storage.set('local', this.s.storageKey + ':quality', q);
    this.applyQuality(q);
  }

  private applyQuality(q: Quality): void {
    if (this.unsupported) q = 'off';
    if (q === this.q || this.destroyed) return;
    this.q = q;
    if (q !== 'off') {
      // Same fallback as init(). The overlay is only missing while off, so the page is already settled.
      try { this.mountOverlay(); } catch (error) {
        this.unsupported = true;
        this.q = 'off';
        console.warn('[swarmtroopers] renderer unavailable; content remains visible', error);
        return;
      }
    }
    try {
      if (q === 'off') {
        this.finish();
        this.overlay?.destroy();
        this.overlay = null;
      } else this.overlay?.setCap(PROFILES[q].dprCap);
      this.events.emit('quality', { quality: q });
      this.wake();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Ties an element (a control panel…) to the troopers: it is removed by destroy(). */
  own(el: Element): void {
    this.owned.push(el);
  }

  /** Removes everything the troopers added and restores the page as it was. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
    this.invalidateSoon.cancel();
    for (const a of this.agents) this.cancelJob(a);
    for (const t of this.tasks) this.safe(() => {
      this.restoreClasses(t);
      if (t.state !== 'done') this.restoreClip(t);
    });
    this.safe(() => this.io?.disconnect());
    this.safe(() => this.ro?.disconnect());
    this.safe(() => this.overlay?.destroy());
    this.overlay = null;
    for (const off of this.unlisten.splice(0)) this.safe(off);
    for (const cleanup of this.pluginCleanups.splice(0)) this.safe(cleanup);
    for (const el of this.owned.splice(0)) this.safe(() => el.remove());
    this.events.clear();
    this.agents.length = this.anns.length = this.queue.length = 0;
    this.rects.clear();
    if (this.stylesOwned) {
      this.stylesOwned = false;
      this.safe(releaseStyles);
    }
    if (ACTIVE_ROOTS.get(this.root) === this) ACTIVE_ROOTS.delete(this.root);
    document.documentElement.classList.remove('swarmtroopers-preload');
  }

  private safe(fn: () => void): void {
    try { fn(); } catch (error) { console.warn('[swarmtroopers] cleanup or extension failed', error); }
  }

  private fail(error: unknown): void {
    console.warn('[swarmtroopers] animation stopped; original content restored', error);
    this.destroy();
  }

  private restoreClip(t: Task): void {
    if (t.prevClip) t.el.style.setProperty('clip-path', t.prevClip, t.prevClipPriority);
    else t.el.style.removeProperty('clip-path');
    if (this.masked.delete(t.el)) for (const p of MASK_PROPS) t.el.style.removeProperty(p);
  }

  /**
   * Reveals the top-left part of an element. A gradient mask gives it a soft edge; an element with a mask of
   * its own, or a browser without mask compositing, gets the hard clip-path instead.
   */
  private sweep(t: Task, x: number, y: number): void {
    const el = t.el;
    const px = clamp(x, 0, 1);
    const py = clamp(y, 0, 1);
    if (!this.masked.has(el)) {
      const own = el.style.getPropertyValue('mask-image') || el.style.getPropertyValue('-webkit-mask-image') || getComputedStyle(el).getPropertyValue('mask-image');
      if (!SOFT_MASK || (own && own !== 'none')) {
        el.style.clipPath = `inset(0 ${(100 - px * 100).toFixed(2)}% ${(100 - py * 100).toFixed(2)}% 0)`;
        return;
      }
      this.masked.add(el);
      el.style.setProperty('mask-repeat', 'no-repeat');
      el.style.setProperty('-webkit-mask-repeat', 'no-repeat');
      el.style.setProperty('mask-composite', 'intersect');
      el.style.setProperty('-webkit-mask-composite', 'source-in');
    }
    // The soft band shrinks to nothing as the sweep ends, so the finished element is whole.
    const edge = (p: number): string => `#000 calc(${(p * 100).toFixed(2)}% - ${(FEATHER * (1 - p)).toFixed(1)}px),transparent ${(p * 100).toFixed(2)}%`;
    const mask = `linear-gradient(to right,${edge(px)}),linear-gradient(to bottom,${edge(py)})`;
    el.style.setProperty('mask-image', mask);
    el.style.setProperty('-webkit-mask-image', mask);
    if (t.prevClip) el.style.setProperty('clip-path', t.prevClip, t.prevClipPriority);
    else el.style.removeProperty('clip-path');
  }

  private restoreClasses(t: Task): void {
    t.el.classList.remove('swarmtroopers-pending');
    t.el.classList.toggle('swarmtroopers-pop', t.prevPop);
  }

  /** `swarmtroopers-pending` is ours alone: found on an element we do not track (a DOM snapshot taken mid-build), it would hide it for good. */
  private sweepStale(): void {
    for (const el of this.root.querySelectorAll('.swarmtroopers-pending')) if (!this.byEl.has(el)) el.classList.remove('swarmtroopers-pending');
  }

  private cancelJob(a: Agent): void {
    const job = a.job;
    a.job = null;
    if (job) this.safe(() => { job.return(undefined); });
    for (const n of this.anns) if (this.annotationOwners.get(n) === a) n.done();
    a.hold = a.dim = a.rest = false;
    a.shape = 'arrow';
    a.doing = null;
  }

  private revealChain(t: Task): void {
    if (t.state === 'done') return;
    for (const dependency of t.deps) this.revealChain(dependency);
    for (const agent of this.agents) if (agent.task === t) {
      this.cancelJob(agent);
      agent.task = null;
    }
    this.complete(t);
  }

  private prune(): void {
    const removed = new Set(this.tasks.filter(t => !t.el.isConnected || !this.root.contains(t.el) || !t.el.getClientRects().length));
    if (!removed.size) return;
    for (const a of this.agents) if (a.task && removed.has(a.task)) {
      this.cancelJob(a);
      a.task = null;
    }
    for (const t of removed) {
      // Hidden, not gone: remembered without holding a slot of the task budget.
      if (t.state === 'done' && this.root.contains(t.el)) this.built.add(t.el);
      this.restoreClasses(t);
      if (t.state !== 'done') this.restoreClip(t);
      this.io?.unobserve(t.el);
      this.byEl.delete(t.el);
    }
    this.tasks = this.tasks.filter(t => !removed.has(t));
    for (const t of this.tasks) {
      t.deps = t.deps.filter(d => !removed.has(d));
      if (t.parent && removed.has(t.parent)) t.parent = null;
      if (t.source && removed.has(t.source)) t.source = null;
    }
    for (const sec of this.sections) sec.tasks = sec.tasks.filter(t => !removed.has(t));
    this.sections = this.sections.filter(sec => {
      if (sec.tasks.length) return true;
      if (sec.zone) {
        sec.zone.done();
        this.anns = this.anns.filter(annotation => annotation !== sec.zone);
        sec.zone = null;
      }
      return false;
    });
    const kept = new Set(this.sections);
    for (const [key, sec] of this.sectionByKey) if (!kept.has(sec)) this.sectionByKey.delete(key);
    for (const a of this.agents) if (a.squad && !kept.has(a.squad)) a.squad = null;
    if (this.insp.el && !this.insp.el.isConnected) this.insp.el = null;
    if (this.insp.want && !this.insp.want.isConnected) this.insp.want = null;
    if (this.pointer && !this.pointer.isConnected) this.pointer = null;
    if (this.lead) {
      this.cancelJob(this.lead);
      this.lead.job = this.leadLoop(this.lead);
    }
    this.doneCount = this.tasks.filter(t => t.state === 'done').length;
    this.rects.clear();
  }

  // ─── setup ────────────────────────────────────────────────────────────────

  private resolveQuality(): Quality {
    const saved = storage.get('local', this.s.storageKey + ':quality');
    if (saved === 'full' || saved === 'light' || saved === 'off') return saved;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'off';
    if (this.s.quality !== 'auto') return this.s.quality;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return 'light';
    if ((nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4) return 'light';
    return 'full';
  }

  private paint(chat: boolean | ChatOptions): void {
    this.bg = pageBackground();
    const dark = relativeLuminance(this.bg) < 0.35;
    this.halo = `rgb(${this.bg.join(', ')})`;
    this.ink = dark ? 'rgb(236, 238, 242)' : 'rgb(13, 14, 17)';
    const p = this.s.palette ?? [dark ? '#ECEEF2' : '#0D0E11', '#7DB4FF', '#B98CFF', '#5FE3D0', '#FF7EB6'];
    this.palette = Array.isArray(p) && p.length ? p : buildPalette({ lightness: dark ? 0.76 : 0.6, ...(Array.isArray(p) ? {} : p) });
    // Tasks, names and the finale follow the locale even with the bubbles off.
    const pack = chatPack({ locale: this.s.locale, ...(typeof chat === 'object' ? chat : {}) });
    this.subjects = pack.subjects;
    this.leadName = this.s.leadName ?? pack.lead;
    this.words = { tasks: pack.tasks, kinds: pack.kinds };
    this.doneText = pack.lines.done[0] ?? '';
    this.summary = pack.summary;
    if (chat === true || (typeof chat === 'object' && chat.bubbles !== false)) this.chat = { lines: pack.lines, subjects: pack.subjects };
    const sans = getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif';
    this.look = { halo: this.halo, ink: this.ink, sans, scale: this.s.scale ?? (this.narrow() ? 1.05 : 1.2) };
  }

  private narrow(): boolean {
    return window.innerWidth < 600;
  }

  private init(): void {
    this.skipBuild = this.s.once === 'session' && storage.get('session', this.s.storageKey + ':seen') === '1';
    const build = this.q !== 'off' && !this.skipBuild;
    if (this.q !== 'off') {
      try { this.mountOverlay(); } catch (error) {
        this.unsupported = true;
        this.q = 'off';
        console.warn('[swarmtroopers] renderer unavailable; content remains visible', error);
      }
    }
    const canBuild = build && this.q !== 'off';
    this.sweepStale();
    if (canBuild || this.s.inspect) this.collect(canBuild);
    // Lifted only once the enrolled elements are hidden by the troopers themselves, so nothing flashes or starts a transition.
    document.documentElement.classList.remove('swarmtroopers-preload');

    this.listen(this.root, 'focusin', (event) => {
      for (let el = event.target instanceof Element ? event.target : null; el && el !== this.root.parentElement; el = el.parentElement) {
        const task = this.byEl.get(el);
        if (task) this.revealChain(task);
      }
      this.wake();
    });
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motion) this.listen(motion, 'change', () => {
      // Same precedence as a reload: only a choice saved by the reader outranks the system setting.
      const saved = storage.get('local', this.s.storageKey + ':quality');
      if (!['full', 'light', 'off'].includes(saved ?? '')) this.applyQuality(this.resolveQuality());
    });
    this.listen(window, 'beforeprint', () => this.finish());
    const print = window.matchMedia?.('print');
    if (print) this.listen(print, 'change', () => { if (print.matches) this.finish(); });
    this.listen(window, 'resize', () => this.invalidateSoon(), { passive: true });
    this.listen(window, 'scroll', () => this.onScroll(), { passive: true });
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) this.listen(window, type, () => this.dismiss(), { passive: true });
    this.listen(document, 'visibilitychange', () => {
      if (!document.hidden) this.wake();
    });
    if (this.s.inspect) {
      this.listen(document, 'pointermove', (e) => this.onPointer(e as PointerEvent), { passive: true });
      this.listen(document.documentElement, 'pointerleave', () => {
        this.pointer = null;
        this.wake();
      });
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.invalidateSoon());
      this.ro.observe(this.root);
    }
    document.fonts?.ready.then(() => this.invalidate()).catch(() => undefined);

    if (!canBuild) {
      this.started = true;
      this.finished = true;
      return;
    }
    if (this.s.trigger === 'immediate') this.start();
    else if (this.s.trigger === 'scroll') {
      const kinds = ['scroll', 'wheel', 'touchmove', 'keydown', 'pointerdown'];
      const go = (): void => {
        stop();
        this.start();
      };
      const stop = (): void => kinds.forEach((k) => window.removeEventListener(k, go));
      kinds.forEach((k) => window.addEventListener(k, go, { passive: true }));
      this.unlisten.push(stop);
    }
  }

  /** Scans the root and creates the tasks it does not know yet, grouped by section. */
  private collect(build: boolean): void {
    const drafts = scan(this.root, { auto: this.s.auto, selector: this.s.selector, maxTasks: this.s.maxTasks, known: el => this.byEl.has(el) || this.built.has(el) });
    const created = new Map<object, Task>();
    for (const d of drafts) {
      if (this.byEl.has(d.el)) continue;
      if (this.tasks.length >= this.s.maxTasks) break;
      const tool = d.tool === 'instant' || TOOLS.has(d.tool) ? d.tool : 'frame';
      const section = this.sectionFor(d.el);
      const id = this.taskSeq++;
      const rebuilt = this.built.delete(d.el);
      const t: Task = {
        id,
        el: d.el,
        tool,
        // Never reused, unlike the list length once refresh() has pruned tasks.
        order: id,
        parent: null,
        source: null,
        deps: [],
        section,
        state: build && !rebuilt ? 'pending' : 'done',
        seen: false,
        inView: false,
        waitingSince: 0,
        prevClip: d.el.style.getPropertyValue('clip-path'),
        prevClipPriority: d.el.style.getPropertyPriority('clip-path'),
        prevPop: d.el.classList.contains('swarmtroopers-pop'),
      };
      section.tasks.push(t);
      created.set(d, t);
      this.tasks.push(t);
      this.byEl.set(d.el, t);
    }
    for (const d of drafts) {
      const t = created.get(d);
      if (!t) continue;
      t.parent = d.parent ? (created.get(d.parent) ?? this.byEl.get(d.parent.el) ?? null) : null;
      t.source = d.source ? (created.get(d.source) ?? this.byEl.get(d.source.el) ?? null) : null;
      t.deps = [t.parent, t.source].filter((x): x is Task => !!x);
    }
    this.doneCount = this.tasks.filter(t => t.state === 'done').length;
    const fresh = Array.from(created.values()).filter(t => t.state === 'pending');
    for (const t of fresh) t.el.classList.add('swarmtroopers-pending');
    if (fresh.length) this.observe(fresh);
  }

  private sectionFor(el: Element): Section {
    let found: Element | null = null;
    for (let n: Element | null = el; n && n !== this.root; n = n.parentElement) if (n.matches(SECTION)) found = n;
    // Without semantic sections, the page is cut in bands of about one screen.
    const key = found ?? 'band:' + Math.floor((el.getBoundingClientRect().top + window.scrollY) / (window.innerHeight * 0.9));
    let sec = this.sectionByKey.get(key);
    if (!sec) {
      const id = this.sectionSeq++;
      sec = {
        id,
        el: found,
        name: sectionName(found, this.subjects),
        color: this.palette[id % this.palette.length],
        order: id,
        tasks: [],
        planned: false,
        announced: false,
        zone: null,
      };
      this.sections.push(sec);
      this.sectionByKey.set(key, sec);
    }
    return sec;
  }

  private observe(list: Task[]): void {
    if (typeof IntersectionObserver === 'undefined') {
      for (const t of list) t.seen = t.inView = true;
      return;
    }
    if (!this.io) {
      this.io = new IntersectionObserver(
        (entries) => {
          let fresh = false;
          for (const e of entries) {
            const t = this.byEl.get(e.target);
            if (!t) continue;
            t.inView = e.isIntersecting;
            if (e.isIntersecting && !t.seen) {
              t.seen = true;
              fresh = true;
            }
          }
          if (fresh) this.wake();
        },
        { rootMargin: '0px 0px -6% 0px' },
      );
    }
    for (const t of list) this.io.observe(t.el);
  }

  private mountOverlay(): void {
    if (this.overlay) return;
    this.overlay = new Overlay(this.s.zIndex, PROFILES[this.q === 'light' ? 'light' : 'full'].dprCap);
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.unlisten.push(() => target.removeEventListener(type, fn, opts));
  }

  // ─── loop ─────────────────────────────────────────────────────────────────

  private wake(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.destroyed) {
      this.running = false;
      return;
    }
    try {
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      this.clock += dt;
      this.rects.clear();
      this.sx = window.scrollX;
      this.sy = window.scrollY;
      const live = !this.paused && !document.hidden;
      if (live) this.update(dt);
      this.overlay?.render(this.anns, this.agents, this.sx, this.sy, this.look, this.fin);
      if (!this.destroyed && live && this.busy()) this.raf = requestAnimationFrame(this.tick);
      else this.running = false;
    } catch (error) {
      this.running = false;
      this.fail(error);
    }
  };

  /** The loop sleeps as soon as nothing moves. */
  private busy(): boolean {
    if (this.fin) return true;
    if (this.agents.some((a) => !a.rest || a.say) || this.queue.length) return true;
    if (this.anns.some((n) => n.closed || n.ttl !== Infinity)) return true;
    if (this.started && !this.finished && this.hasReady()) return true;
    return this.s.inspect && this.insp.el !== this.insp.want;
  }

  private ready(t: Task): boolean {
    return t.state === 'pending' && t.seen && t.deps.every((d) => d.state === 'done');
  }

  private hasReady(): boolean {
    for (const t of this.tasks) if (this.ready(t)) return true;
    return false;
  }

  private patience(): number {
    return this.s.patience ?? (this.narrow() || this.q === 'light' ? 1.4 : 2.4);
  }

  private update(dt: number): void {
    const prof = PROFILES[this.q === 'light' ? 'light' : 'full'];
    const building = this.started && !this.finished && this.q !== 'off';
    const work: Task[] = [];
    if (building) {
      const patience = this.patience();
      // Elements others wait on (a card before its text) get half the patience, so the screen fills sooner.
      const blocking = new Set<Task>();
      for (const t of this.tasks) if (t.state === 'pending' && t.inView) for (const d of t.deps) blocking.add(d);
      this.follow();
      for (const t of this.tasks) {
        // The patience clock starts when a pending element comes into view, even while it waits on its parent,
        // so a nested element does not add its own wait to its parent's.
        if (t.state === 'pending' && t.inView && !t.waitingSince) t.waitingSince = this.clock || 1e-6;
        // Waiting in view on something nobody will build (a list started above a reloaded page, say):
        // what it waits on is shown, then the element itself.
        if (t.state === 'pending' && t.inView && t.waitingSince && !this.ready(t) && this.clock - t.waitingSince > patience) {
          this.popChain(t);
          continue;
        }
        if (!this.ready(t)) continue;
        if (t.tool === 'instant') {
          this.pop(t);
          continue;
        }
        // Scrolled past before anyone got to it: shown at once, the troopers stay on what is in view.
        const r = this.rect(t.el);
        if (!t.inView && r.y + r.h < this.sy) {
          this.pop(t);
          continue;
        }
        // Patience: nothing in view waits for an agent for long, so the reader never faces an empty screen.
        if (t.inView && t.waitingSince) {
          if (this.clock - t.waitingSince > (blocking.has(t) ? patience * 0.5 : patience)) {
            this.pop(t);
            continue;
          }
        }
        work.push(t);
      }
      if (work.length && !this.lead) {
        if (this.s.finale) this.overlay?.prepareFinale();
        this.lead = this.spawnLead();
      }
    }

    const workers = this.agents.filter((a) => !a.lead && !a.leaving);
    // A backlog speeds the troopers up a little, never to the point where gestures can no longer be followed.
    this.tempo = this.s.speed * prof.tempo * (1 + Math.min(0.5, (work.length / Math.max(1, workers.length)) * 0.12));

    // Each free worker only takes work in its own section.
    if (work.length) {
      work.sort(byPriority);
      for (const a of workers) {
        if (a.job || !a.squad) continue;
        let mine = work.filter((t) => t.section === a.squad);
        if (!mine.some((t) => t.inView)) {
          // Its section went off screen: the worker joins the squad working where the reader is.
          const sec = this.visibleSection(work, prof.squad + 1);
          if (sec && sec !== a.squad) {
            a.squad = sec;
            a.idle = 0;
            mine = work.filter((t) => t.section === sec);
          }
        }
        const t = pickTask(mine, a, 3, (task): Point => {
          const r = this.rect(task.el);
          return { x: r.x, y: r.y };
        });
        if (!t) continue;
        work.splice(work.indexOf(t), 1);
        this.assign(a, t);
      }
    }

    for (const a of this.agents.slice()) this.stepAgent(a, dt);
    if (this.s.inspect && this.q !== 'off' && !this.fin) this.inspect();
    this.converse(dt);

    for (let i = this.anns.length - 1; i >= 0; i--) {
      const n = this.anns[i];
      n.age += dt;
      if (!n.closed && n.age >= n.ttl) n.closed = true;
      if (n.closed && (n.out += dt * 4) >= 1) this.anns.splice(i, 1);
    }

    if (building && this.doneCount >= this.tasks.length) this.wrapUp();
    this.finale(dt);
  }

  // ─── agents ───────────────────────────────────────────────────────────────

  private makeAgent(x: number, y: number, color: string): Agent {
    const a: Agent = {
      id: this.seq++,
      color,
      lead: false,
      squad: null,
      name: '',
      say: null,
      x,
      y,
      shape: 'arrow',
      press: 0,
      hold: false,
      dim: false,
      alpha: 1,
      rest: false,
      task: null,
      job: null,
      idle: 0,
      leaving: false,
      persona: persona(this.r),
      doing: null,
      flip: false,
    };
    this.agents.push(a);
    this.spawned++;
    return a;
  }

  /** The orchestrator walks in from the right edge, near the top of the screen. */
  private spawnLead(): Agent {
    // It fades in where the reader is, wherever the page was opened or reloaded.
    const home = this.leadHome();
    const a = this.makeAgent(home.x, home.y, this.ink);
    a.alpha = 0;
    a.lead = true;
    a.name = this.s.names !== false ? this.leadName : '';
    a.job = this.leadLoop(a);
    return a;
  }

  /**
   * The troopers follow the reader. A task whose element left the screen is settled at once: shown if the reader
   * went past it, put back for later if the reader went back up. Its worker is then free for what is in view.
   */
  private follow(): void {
    const vh = window.innerHeight;
    const margin = vh * 0.25;
    for (const a of this.agents) {
      const t = a.task;
      if (a.lead || !t || !a.job) continue;
      const r = this.rect(t.el);
      const above = r.y + r.h < this.sy - margin;
      const below = r.y > this.sy + vh + margin;
      if (!above && !below) continue;
      this.cancelJob(a);
      a.task = null;
      if (above) this.pop(t);
      else {
        t.state = 'pending';
        t.waitingSince = 0;
        this.restoreClip(t);
        t.el.classList.add('swarmtroopers-pending');
      }
    }
  }

  /** The visible section with the most work waiting and room in its squad. */
  private visibleSection(work: Task[], cap: number): Section | null {
    const count = new Map<Section, number>();
    for (const t of work) if (t.inView) count.set(t.section, (count.get(t.section) ?? 0) + 1);
    let best: Section | null = null;
    let most = 0;
    for (const [sec, n] of count) {
      if (n > most && this.squadOf(sec).length < cap) {
        best = sec;
        most = n;
      }
    }
    return best;
  }

  /** A first name not worn by anyone on screen. */
  private nameFor(): string {
    if (!this.s.names) return '';
    const pool = Array.isArray(this.s.names) && this.s.names.length ? this.s.names : NAMES;
    const used = new Set(this.agents.map((x) => x.name));
    const free = pool.filter((n) => !used.has(n));
    const list = free.length ? free : pool;
    return list[Math.floor(this.r.next() * list.length)];
  }

  private assign(a: Agent, t: Task): void {
    t.state = 'active';
    a.task = t;
    a.idle = 0;
    if (a.name) {
      this.lastWorker = { name: a.name, color: a.color };
      const size = t.tool === 'type' ? parseFloat(getComputedStyle(t.el).fontSize) || 16 : 16;
      a.doing = { text: taskText(this.words, t.tool, kindOf(t.el, t.tool, size)), age: 0 };
      // On a phone, one task at a time is enough to read.
      if (this.narrow()) for (const o of this.agents) if (o !== a) o.doing = null;
    }
    const tool = TOOLS.get(t.tool) ?? TOOLS.get('frame');
    try {
      if (!tool) throw new Error('[swarmtroopers] tool unavailable');
      const job = tool(this.context(a, t));
      if (!job || typeof job.next !== 'function' || typeof job.return !== 'function') throw new TypeError('[swarmtroopers] tool must return a generator');
      a.job = job;
    } catch (error) {
      console.warn('[swarmtroopers] tool failed; element restored', error);
      this.cancelJob(a);
      this.complete(t);
      a.task = null;
    }
  }

  private stepAgent(a: Agent, dt: number): void {
    a.press = a.hold ? 1 : Math.max(0, a.press - dt * 4);
    a.alpha += ((a.dim ? 0.18 : 1) - a.alpha) * Math.min(1, dt * 12);
    if (a.doing && (a.doing.age += dt) > 2.8) a.doing = null;
    if (!a.job) {
      if (a.lead) return;
      // A worker with nothing left in its section goes back to the orchestrator.
      // While its section still has pending work, it waits a little for the next piece to unlock.
      // A resting hand is never still: a slow drift of a few pixels around where it stopped.
      const drift = (t: number, k: number): number => Math.sin(t * 1.7 + a.id * k) * 1.4 + Math.sin(t * 0.6 + a.id * 2 * k) * 2.2;
      a.x += drift(a.idle + dt, 1) - drift(a.idle, 1);
      a.y += drift(a.idle + dt, 3) - drift(a.idle, 3);
      a.idle += dt;
      const pending = !!a.squad && a.squad.tasks.some((t) => t.state === 'pending' && t.tool !== 'instant');
      if (a.idle > (pending ? 2.5 : 0.6)) {
        a.leaving = true;
        a.job = this.regroup(a);
      }
      return;
    }
    let done = false;
    try {
      done = !!a.job.next(dt * this.tempo).done;
    } catch (err) {
      console.warn('[swarmtroopers] a tool failed, its element is shown as is', err);
      this.cancelJob(a);
      done = true;
    }
    if (!done) return;
    a.job = null;
    a.hold = false;
    a.dim = false;
    a.rest = false;
    a.shape = 'arrow';
    if (a.task) {
      this.complete(a.task);
      a.task = null;
    }
    if (a.leaving) {
      this.agents.splice(this.agents.indexOf(a), 1);
      if (a === this.lead) this.lead = null;
    }
  }

  /** Back to the orchestrator, then gone. Without one on screen, out by the nearest edge. */
  private *regroup(a: Agent): ToolGen {
    a.shape = 'arrow';
    a.doing = null;
    if (a.name) this.lastWorker = { name: a.name, color: a.color };
    const lead = this.lead;
    if (!lead || lead.leaving) {
      yield* this.leave(a);
      return;
    }
    yield* this.travel(a, () => ({ x: lead.x + 6, y: lead.y + 6 }), { width: 40 });
    a.dim = true;
    yield* this.wait(0.15);
  }

  /** A worker leaves the orchestrator's hand in turn, fanning out towards its section. */
  private *depart(w: Agent, i: number, n: number, sec: Section, from: Agent): ToolGen {
    let e = 0;
    const delay = 0.15 + i * 0.32;
    while (e < delay) {
      w.x = from.x;
      w.y = from.y;
      w.alpha = 0;
      e += yield;
    }
    const r = this.sectionRect(sec);
    const vh = window.innerHeight;
    const goal = {
      x: r.x + (r.w * (i + 1)) / (n + 1),
      y: clamp(r.y + Math.min(r.h / 2, 160), this.sy + 80, this.sy + vh - 80),
    };
    const dx = goal.x - w.x;
    const dy = goal.y - w.y;
    const d = Math.hypot(dx, dy) || 1;
    const turn = (i - (n - 1) / 2) * 0.45;
    const ux = (dx / d) * Math.cos(turn) - (dy / d) * Math.sin(turn);
    const uy = (dx / d) * Math.sin(turn) + (dy / d) * Math.cos(turn);
    const step = Math.min(d * 0.6, 170);
    yield* this.travel(w, { x: w.x + ux * step, y: w.y + uy * step }, { width: 50 });
  }

  private *leave(a: Agent): ToolGen {
    a.shape = 'arrow';
    const right = a.x - this.sx > window.innerWidth / 2;
    const exit = { x: this.sx + (right ? window.innerWidth + 40 : -40), y: a.y };
    yield* this.travel(a, exit, { width: 160 });
  }

  /** Follows a planned path. If the target moves meanwhile (sticky, marquee…), the path bends towards it. */
  private *travel(a: Agent, to: Point | (() => Point), o: MoveOpts & { onStep?: () => void } = {}): ToolGen {
    const target = typeof to === 'function' ? to : (): Point => to;
    const goal = target();
    // An agent left far behind by the scroll re-enters from the nearest edge instead of crossing the whole page.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (a.y < this.sy - 80) a.y = this.sy - 40;
    else if (a.y > this.sy + vh + 80) a.y = this.sy + vh + 40;
    if (a.x < this.sx - 80) a.x = this.sx - 40;
    else if (a.x > this.sx + vw + 80) a.x = this.sx + vw + 40;
    const segs = planMove({ x: a.x, y: a.y }, goal, a.persona, this.r, o);
    const total = segs.reduce((s, g) => s + g.dur + g.pause, 0) || 1;
    let elapsed = 0;
    for (const seg of segs) {
      let t = -seg.pause;
      while (t < seg.dur) {
        const d: number = yield;
        t += d;
        elapsed += d;
        if (t <= 0) continue;
        const p = pointOn(seg, Math.min(t, seg.dur));
        const g = target();
        const k = Math.min(1, elapsed / total);
        a.x = p.x + (g.x - goal.x) * k;
        a.y = p.y + (g.y - goal.y) * k;
        o.onStep?.();
      }
    }
    const g = target();
    a.x = g.x;
    a.y = g.y;
    o.onStep?.();
  }

  private *wait(seconds: number): ToolGen {
    let e = 0;
    while (e < seconds) e += yield;
  }

  // ─── orchestrator ─────────────────────────────────────────────────────────

  /** Survey, dispatch, check, and inspect once the page is built. */
  private *leadLoop(a: Agent): ToolGen {
    for (;;) {
      a.rest = false;
      const next = this.building() ? this.nextSection() : null;
      if (next) {
        yield* this.dispatch(a, next.section, next.reinforce);
        continue;
      }
      const el = this.insp.want;
      if (el) {
        yield* this.inspectWith(a, el);
        continue;
      }
      const fresh = this.building() ? this.nextReview() : null;
      if (fresh) {
        yield* this.check(a, fresh);
        continue;
      }
      if (this.finished && !this.agents.some((x) => !x.lead)) {
        // Let the last words be read, then leave. Inspection calls it back.
        while (a.say) yield;
        a.leaving = true;
        yield* this.leave(a);
        return;
      }
      const home = this.leadHome();
      if (Math.hypot(a.x - home.x, a.y - home.y) > 90) {
        yield* this.travel(a, home, { width: 60 });
        continue;
      }
      a.rest = true;
      yield;
    }
  }

  private building(): boolean {
    return this.started && !this.finished && this.q !== 'off';
  }

  /** Top right of the screen, out of the way of the content. */
  private leadHome(): Point {
    const vw = window.innerWidth;
    return { x: this.sx + vw - Math.min(150, vw * 0.22), y: this.sy + window.innerHeight * 0.2 };
  }

  private squadOf(sec: Section): Agent[] {
    return this.agents.filter((a) => a.squad === sec && !a.leaving);
  }

  /** A section with work and nobody on it, the visible ones first. Or a squad drowning in work. */
  private nextSection(): { section: Section; reinforce: boolean } | null {
    const prof = PROFILES[this.q === 'light' ? 'light' : 'full'];
    const max = Math.min(this.s.max ?? prof.max, this.q === 'light' ? prof.max : 32);
    const busy = this.agents.filter((a) => !a.lead && !a.leaving).length;
    if (busy >= max) return null;
    let best: Section | null = null;
    let bestScore = Infinity;
    let rush: Section | null = null;
    for (const sec of this.sections) {
      let readyCount = 0;
      let visible = false;
      for (const t of sec.tasks) {
        if (t.tool === 'instant' || !this.ready(t)) continue;
        readyCount++;
        if (t.inView) visible = true;
      }
      if (!readyCount) continue;
      const squad = this.squadOf(sec).length;
      if (!squad) {
        const score = (visible ? 0 : 1000) + sec.order;
        if (score < bestScore) {
          bestScore = score;
          best = sec;
        }
      } else if (visible && readyCount > squad * 4 && squad < prof.squad + 1) rush = sec;
    }
    if (best) return { section: best, reinforce: false };
    return rush ? { section: rush, reinforce: true } : null;
  }

  /** Visible part of a section, in document coordinates. */
  private sectionRect(sec: Section): Rect {
    if (sec.el) return this.rect(sec.el);
    if (!sec.tasks.length) return { x: this.sx, y: this.sy, w: 0, h: 0 };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const t of sec.tasks) {
      const r = this.rect(t.el);
      // Built content hidden for now (an inactive tab panel) has no box to count.
      if (!r.w && !r.h) continue;
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    return x1 < x0 ? { x: this.sx, y: this.sy, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private *dispatch(a: Agent, sec: Section, reinforce: boolean): ToolGen {
    const prof = PROFILES[this.q === 'light' ? 'light' : 'full'];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const corner = (): Point => {
      const r = this.sectionRect(sec);
      return { x: clamp(r.x, this.sx + 24, this.sx + vw - 60), y: clamp(r.y, this.sy + 40, this.sy + vh - 120) };
    };
    yield* this.travel(a, corner, { width: 80 });
    // Fan out first, so nothing in view waits on the survey: the squad leaves from the orchestrator's hand.
    // Sized on what is left in the section, not only on what is unlocked right now.
    const ready = sec.tasks.filter((t) => this.ready(t) && t.tool !== 'instant').length;
    const left = sec.tasks.filter((t) => t.state === 'pending' && t.tool !== 'instant').length;
    const room = Math.min(this.s.max ?? prof.max, this.q === 'light' ? prof.max : 32) - this.agents.filter((x) => !x.lead && !x.leaving).length;
    const n = clamp(Math.ceil(left / 5), 1, Math.max(1, Math.min(room, reinforce ? 2 : prof.squad)));
    if (ready && room > 0) {
      this.speak(a, this.line(reinforce ? 'rush' : 'plan', sec.name, n));
      const sent: Agent[] = [];
      for (let i = 0; i < n; i++) {
        const w = this.makeAgent(a.x, a.y, sec.color);
        w.squad = sec;
        w.name = this.nameFor();
        const pool = Array.isArray(this.s.names) && this.s.names.length ? this.s.names : NAMES;
        const identity = w.name ? pool.indexOf(w.name) : w.id;
        w.color = this.palette[identity % this.palette.length];
        w.alpha = 0;
        w.job = this.depart(w, i, n, sec, a);
        sent.push(w);
      }
      if (this.chat && this.r.chance(0.35)) this.reply(sent[0]);
    }
    if (!sec.planned && !reinforce) {
      // Survey: while the squad gets to work, a sweep along the top of the section draws its outline.
      sec.planned = true;
      let progress = 0;
      const zone = this.mark(a, {
        kind: 'zone',
        color: sec.color,
        rect: () => {
          const r = this.sectionRect(sec);
          return { x: r.x, y: r.y, w: r.w * progress, h: r.h };
        },
      });
      sec.zone = zone;
      const start = corner();
      const span = Math.max(1, Math.min(this.sectionRect(sec).w, this.sx + vw - 40 - start.x));
      yield* this.travel(a, () => ({ x: corner().x + span, y: corner().y }), {
        drag: true,
        width: 120,
        onStep: () => {
          progress = clamp((a.x - start.x) / span, 0, 1);
        },
      });
      progress = 1;
      if (sec.tasks.every((t) => t.state === 'done')) {
        zone.done();
        sec.zone = null;
      }
    }
    // Let the line be read before moving on, without holding the next section for long.
    const said = a.say;
    let e = 0;
    while (said && a.say === said && said.age < said.ttl * 0.7 && e < 1.4) e += yield;
    yield* this.wait(0.3);
  }

  /** The most recent piece of work still on screen, if any. Older ones are let go. */
  private nextReview(): Task | null {
    while (this.review.length) {
      const t = this.review.pop()!;
      if (t.inView && t.el.isConnected) {
        this.review.length = 0;
        return t;
      }
    }
    return null;
  }

  /** Between two dispatches the orchestrator looks over what a worker just finished: over, a tap, a beat. */
  private *check(a: Agent, t: Task): ToolGen {
    // Dispatching comes first: the look is dropped as soon as a section waits for a squad.
    const urgent = (): boolean => this.building() && !!this.nextSection();
    const at = (): Point => {
      const r = this.rect(t.el);
      return { x: r.x + r.w - Math.min(24, r.w / 4), y: r.y + Math.min(16, r.h / 2) };
    };
    const go = this.travel(a, at, { width: 40 });
    for (let step = go.next(); !step.done; ) {
      if (urgent()) {
        go.return(undefined);
        return;
      }
      const dt: number = yield;
      step = go.next(dt);
    }
    a.press = 1;
    this.mark(a, { kind: 'select', rect: () => this.rect(t.el), ttl: 0.55 });
    for (let e = 0, beat = this.r.range(0.45, 0.8); e < beat && !urgent(); ) e += yield;
  }

  private *inspectWith(a: Agent, el: SwarmTroopersElement): ToolGen {
    const t = this.byEl.get(el);
    yield* this.travel(a, () => {
      const r = this.rect(el);
      return { x: r.x + Math.min(28, r.w / 3), y: r.y + Math.min(16, r.h / 3) };
    }, { width: 40 });
    const mark = this.mark(a, { kind: 'select', rect: () => this.rect(el), label: this.labelFor(el, t ? t.tool : 'frame', true) });
    try {
      while (this.insp.want === el) {
        a.rest = true;
        yield;
      }
    } finally {
      a.rest = false;
      mark.done();
    }
  }

  // ─── tasks ────────────────────────────────────────────────────────────────

  private context(a: Agent, t: Task): ToolContext {
    const el = t.el;
    const self = this;
    return {
      el,
      task: t,
      agent: a,
      random: this.r,
      rect: () => this.rect(el),
      sourceRect: () => (t.source ? this.rect(t.source.el) : null),
      move: (to, o) => this.travel(a, to, o),
      wait: (seconds) => self.wait(seconds),
      click: function* (): ToolGen {
        a.press = 1;
        let e = 0;
        while (e < 0.07) e += yield;
      },
      shape: (shape) => {
        a.shape = shape;
      },
      hold: (on) => {
        a.hold = on;
      },
      dim: (on) => {
        a.dim = on;
      },
      mark: (init) => this.mark(a, init),
      label: () => this.labelFor(el, t.tool),
      text: () => this.text(el),
      reveal: {
        begin: (clip) => {
          if (clip) el.style.clipPath = clip;
          el.classList.remove('swarmtroopers-pending');
        },
        clip: (value) => {
          el.style.clipPath = value;
        },
        sweep: (x, y) => this.sweep(t, x, y),
        end: () => {
          this.restoreClip(t);
        },
        pop: () => this.pop(t),
        settle: () => this.pop(t, 'swarmtroopers-settle', 460),
      },
    };
  }

  private complete(t: Task): void {
    if (t.state === 'done') return;
    t.state = 'done';
    this.doneCount++;
    t.el.classList.remove('swarmtroopers-pending');
    this.restoreClip(t);
    this.io?.unobserve(t.el);
    // Only work a worker did is worth a look, not what appeared on its own. The last few are enough.
    if (this.building() && t.inView && t.tool !== 'instant' && this.agents.some((x) => x.task === t) && this.review.push(t) > 6) this.review.shift();
    this.events.emit('task', { el: t.el, tool: t.tool });
    const sec = t.section;
    if (!sec.announced && sec.tasks.every((x) => x.state === 'done')) {
      sec.announced = true;
      sec.zone?.done();
      sec.zone = null;
      // The orchestrator checks the sections it surveyed, and only those still on screen.
      if (sec.planned && this.lead && !this.finished && t.inView) this.speak(this.lead, this.line('ready', sec.name));
    }
  }

  private popChain(t: Task): void {
    if (t.state !== 'pending') return;
    for (const d of t.deps) this.popChain(d);
    this.pop(t);
  }

  private pop(t: Task, cls = 'swarmtroopers-pop', ms = 260): void {
    if (t.state === 'done') return;
    const el = t.el;
    el.classList.add(cls);
    this.complete(t);
    window.setTimeout(() => (cls === 'swarmtroopers-pop' ? el.classList.toggle(cls, t.prevPop) : el.classList.remove(cls)), ms);
  }

  private wrapUp(finale = true): void {
    if (this.finished) return;
    this.finished = true;
    if (this.s.once === 'session') storage.set('session', this.s.storageKey + ':seen', '1');
    const duration = this.t0 ? (performance.now() - this.t0) / 1000 : 0;
    if (finale && this.s.finale && this.q !== 'off' && this.overlay && this.spawned > 0) {
      // The page is complete: a clap where the orchestrator stands closes the show.
      this.queue.length = 0;
      for (const a of this.agents) a.say = null;
      const right = this.lead ?? { name: this.s.names !== false ? this.leadName : '', color: this.ink };
      const left = this.lastWorker ?? { name: this.nameFor(), color: this.palette[0] };
      const at = this.lead ? { x: this.lead.x - this.sx, y: this.lead.y - this.sy } : { x: innerWidth / 2, y: innerHeight / 2 };
      this.fin = {
        age: 0,
        close: 0,
        at,
        left: { name: this.s.names !== false ? left.name : '', color: left.color },
        right: { name: right.name, color: right.color },
        title: this.doneText,
        sub: this.summary
          .replace('{t}', String(this.tasks.length))
          .replace('{a}', String(this.spawned))
          .replace('{d}', String(Math.max(1, Math.round(duration)))),
      };
    } else if (this.lead && this.q !== 'off') {
      this.queue.length = 0;
      this.say(this.lead, this.line('done'), 2.4);
    }
    this.events.emit('done', { tasks: this.tasks.length, agents: this.spawned, duration });
  }

  /** Runs the closing high five, and sends the troopers away under its veil. */
  private finale(dt: number): void {
    const f = this.fin;
    if (!f) return;
    f.age += dt;
    if (f.close) f.close += dt;
    if (f.age > 0.35 && this.agents.length) {
      for (const a of this.agents) this.cancelJob(a);
      this.agents.length = 0;
      this.lead = null;
    }
    if ((f.close && f.close > FINALE_OUT) || f.age > FINALE_END) this.fin = null;
  }

  /** Any deliberate input closes the finale at once. Momentum scrolling does not count. */
  private dismiss(): void {
    if (this.fin && !this.fin.close && this.fin.age > 0.5) {
      this.fin.close = 1e-6;
      this.wake();
    }
  }

  private onScroll(): void {
    if (this.started && !this.finished) {
      // At the very bottom, whatever is left counts as seen (short last sections, hidden anchors).
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        let fresh = false;
        for (const t of this.tasks) {
          if (!t.seen) {
            t.seen = true;
            fresh = true;
          }
        }
        if (fresh) this.wake();
      }
    }
    if (this.anns.length || this.agents.length) this.wake();
  }

  // ─── conversation ─────────────────────────────────────────────────────────

  private line(key: ChatKey, subject = '', n = 0): string {
    const list = this.chat?.lines[key] ?? [];
    return list.length ? fill(list[Math.floor(this.r.next() * list.length)], subject, n) : '';
  }

  private say(a: Agent, text: string, ttl?: number): void {
    if (!text) return;
    // About a third of a second per word, on top of a base time to notice the bubble.
    const words = text.split(/\s+/).length;
    a.say = { text, age: 0, ttl: ttl ?? Math.min(4.5, 1.8 + words * 0.32) };
  }

  private talking(): number {
    let n = 0;
    for (const a of this.agents) if (a.say) n++;
    return n;
  }

  /**
   * The orchestrator speaks at once, its new line replacing the previous one, so what it says
   * always matches where it stands. Other lines wait their turn and are dropped if they come too late.
   */
  private speak(a: Agent, text: string): void {
    if (!text || !this.chat || this.q === 'off') return;
    if (a.lead) {
      this.queue = this.queue.filter((m) => m.a !== a);
      if (this.narrow()) for (const o of this.agents) if (o !== a) o.say = null;
      this.say(a, text);
      return;
    }
    this.queue.push({ a, text, at: this.clock, until: this.clock + 2.5, overlap: false });
  }

  /** A short answer may overlap the line it answers. */
  private reply(a: Agent): void {
    this.queue.push({ a, text: this.line('reply'), at: this.clock + this.r.range(0.5, 0.8), until: this.clock + 2, overlap: true });
  }

  private converse(dt: number): void {
    for (const a of this.agents) if (a.say && (a.say.age += dt) > a.say.ttl) a.say = null;
    if (!this.chat || this.q === 'off') {
      this.queue.length = 0;
      return;
    }
    for (let i = 0; i < this.queue.length; i++) {
      const m = this.queue[i];
      if (m.until < this.clock || !this.agents.includes(m.a)) {
        this.queue.splice(i--, 1);
        continue;
      }
      if (m.at > this.clock || m.a.say) continue;
      if (this.talking() >= (m.overlap && !this.narrow() ? 2 : 1)) continue;
      this.say(m.a, m.text);
      this.queue.splice(i--, 1);
    }
  }

  // ─── inspection ───────────────────────────────────────────────────────────

  private onPointer(e: PointerEvent): void {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    this.pointer = e.target instanceof Element ? e.target : null;
    if (this.q !== 'off') this.wake();
  }

  /** After a short hover on a finished element, it is handed to the orchestrator. */
  private inspect(): void {
    let el: SwarmTroopersElement | null = null;
    for (let n: Element | null = this.pointer; n && n !== this.root.parentElement; n = n.parentElement) {
      const t = this.byEl.get(n);
      if (t && t.state === 'done') {
        el = t.el;
        break;
      }
    }
    const i = this.insp;
    if (el !== i.el) {
      i.el = el;
      i.since = this.clock;
    }
    if (el && el !== i.want && this.clock - i.since > 0.22) {
      i.want = el;
      if (!this.lead) this.lead = this.spawnLead();
    } else if (!el && i.want && this.clock - i.since > 0.35) i.want = null;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private mark(a: Agent | null, init: AnnotationInit): Annotation {
    const n: Annotation = {
      ...init,
      color: init.color ?? a?.color ?? this.palette[0],
      ttl: init.ttl ?? Infinity,
      age: 0,
      out: 0,
      closed: false,
      done: () => {
        n.closed = true;
      },
    };
    if (a) this.annotationOwners.set(n, a);
    this.anns.push(n);
    return n;
  }

  private labelFor(el: SwarmTroopersElement, tool: string, force = false): string {
    if (!force && (!this.s.labels || this.narrow())) return '';
    for (const p of this.plugins) {
      try {
        const s = p.label?.(el, tool);
        if (s) return s;
      } catch (err) {
        console.warn(`[swarmtroopers] plugin "${p.name}" failed to label an element`, err);
      }
    }
    const r = this.rect(el);
    if (tool === 'type') return `${el.localName} · ${Math.round(parseFloat(getComputedStyle(el).fontSize))}px`;
    if (tool === 'rule') return `${Math.round(Math.max(r.w, r.h))}px`;
    return `${Math.round(r.w)} × ${Math.round(r.h)}`;
  }

  private text(el: SwarmTroopersElement): TextGeo | null {
    const hit = this.geos.get(el);
    if (hit && hit.v === this.layout) return hit.geo;
    const geo = measureText(el, (node) => {
      for (let p = node.parentElement; p && p !== el; p = p.parentElement) if (this.byEl.has(p)) return true;
      return false;
    });
    this.geos.set(el, { v: this.layout, geo });
    return geo;
  }

  /** Live document rectangle, read at most once per frame. */
  private rect(el: Element): Rect {
    let r = this.rects.get(el);
    if (!r) {
      const b = el.getBoundingClientRect();
      r = { x: b.left + this.sx, y: b.top + this.sy, w: b.width, h: b.height };
      this.rects.set(el, r);
    }
    return r;
  }

  private invalidate(): void {
    if (this.destroyed) return;
    this.layout++;
    this.overlay?.resize();
    for (const p of this.plugins) this.safe(() => p.invalidate?.());
    this.wake();
  }
}
