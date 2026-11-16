import type { SwarmTroopersElement } from './types.js';

export interface Draft {
  el: SwarmTroopersElement;
  tool: string;
  parent: Draft | null;
  source: Draft | null;
}

export interface ScanOptions {
  auto: boolean;
  selector: string;
  maxTasks: number;
  known?(el: Element): boolean;
}

const SKIP = new Set([
  'script', 'style', 'noscript', 'template', 'link', 'meta', 'br', 'wbr', 'head', 'title', 'base',
  'source', 'track', 'param', 'area', 'map', 'option', 'optgroup', 'datalist', 'slot', 'swarmtroopers-overlay',
]);
const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'picture', 'iframe', 'object', 'embed', 'audio']);
const FIELDS = new Set(['input', 'select', 'textarea', 'progress', 'meter']);
// A negative tabindex is a programmatic focus target (skip-link landing, route focus wrapper), not a control.
const INTERACTIVE = 'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable=false]),[tabindex]:not([tabindex^="-"]),[role=button],[role=link]';

/** Alpha channel of a computed colour, whatever its syntax (rgb, rgba, color(), lab()…). */
export function alphaOf(color: string): number {
  if (!color || color === 'transparent') return 0;
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)\s*$/);
  if (slash) return slash[2] ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
  const legacy = color.match(/^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/);
  if (legacy) return parseFloat(legacy[1]);
  return 1;
}

/** Does the element paint a box of its own: background, border or shadow? */
export function hasBox(cs: CSSStyleDeclaration): boolean {
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
  if (alphaOf(cs.backgroundColor) > 0.01) return true;
  if (cs.boxShadow && cs.boxShadow !== 'none') return true;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const style = cs.getPropertyValue(`border-${side}-style`);
    if (style === 'none' || style === 'hidden') continue;
    if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && alphaOf(cs.getPropertyValue(`border-${side}-color`)) > 0.01) return true;
  }
  return false;
}

/** `flow`: the element holds a run of text (only inline children). `own`: it has text nodes of its own. */
function textInfo(el: Element): { own: boolean; flow: boolean } {
  let own = false;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3 && /\S/.test(n.nodeValue || '')) {
      own = true;
      break;
    }
  }
  for (const c of Array.from(el.children)) {
    if (SKIP.has(c.localName)) continue;
    const d = getComputedStyle(c).display;
    if (d === 'none') continue;
    if (d !== 'inline' && d !== 'inline-block' && d !== 'contents') return { own, flow: false };
  }
  return { own, flow: /\S/.test(el.textContent || '') };
}

/**
 * Boxes taller than the screen (sections with a top border, page-wide bands) are not framed:
 * the drag would leave the screen and hold back everything inside. They stay visible and their content is built.
 */
const isHuge = (r: DOMRect, vw: number, vh: number): boolean => r.height > vh * 0.9 || (r.width >= vw * 0.96 && r.height >= vh * 0.6);

function classify(el: Element, cs: CSSStyleDeclaration, r: DOMRect, vw: number, vh: number): { name: string | null; recurse: boolean } {
  const tag = el.localName;
  if (MEDIA.has(tag)) return { name: r.width * r.height < 1100 ? 'instant' : 'frame', recurse: false };
  if (FIELDS.has(tag)) return { name: 'frame', recurse: false };
  const box = hasBox(cs);
  const thin = (r.height <= 3 && r.width >= 24) || (r.width <= 3 && r.height >= 24);
  if (tag === 'hr' || (thin && box)) return { name: 'rule', recurse: false };
  const text = textInfo(el);
  if (text.flow) return { name: box ? 'frame' : 'type', recurse: false };
  if (box && !isHuge(r, vw, vh)) return { name: 'frame', recurse: true };
  if (text.own) return { name: 'type', recurse: true };
  return { name: null, recurse: true };
}

/** Children that look like items of one list: same tag and classes, the large majority of the children. */
function repeatGroup(el: Element, budget: number): Set<Element> | null {
  if (el.children.length > budget) return null;
  const kids = Array.from(el.children).filter((c) => !SKIP.has(c.localName));
  if (kids.length < 2) return null;
  const groups = new Map<string, Element[]>();
  for (const c of kids) {
    const key = c.localName + '|' + Array.from(c.classList).filter((x) => !x.startsWith('swarmtroopers-')).sort().join(' ');
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  let best: Element[] = [];
  for (const g of groups.values()) if (g.length > best.length) best = g;
  const min = /^(ul|ol|menu|dl)$/.test(el.localName) ? 2 : 3;
  return best.length >= min && best.length >= kids.length * 0.6 ? new Set(best) : null;
}

/**
 * Turns the DOM into a list of drafts in reading order.
 * Annotated elements use their data-swarmtroopers value. In auto mode (or inside data-swarmtroopers="scan")
 * every element is classified from its computed style.
 */
export function scan(root: Element, o: ScanOptions): Draft[] {
  const out: Draft[] = [];
  let visits = 0;
  const visitLimit = Math.max(100, o.maxTasks * 8);
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const preloading = document.documentElement.classList.contains('swarmtroopers-preload');

  const add =(el: SwarmTroopersElement, tool: string, parent: Draft | null, source: Draft | null): Draft => {
    const d: Draft = { el, tool, parent, source };
    out.push(d);
    return d;
  };

  const walk = (el: Element, parent: Draft | null, depth: number, auto: boolean, everyChild: boolean, implicit: boolean): void => {
    const group = auto && !everyChild ? repeatGroup(el, o.maxTasks - out.length) : null;
    let prev: Draft | null = null;
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (out.length >= o.maxTasks || visits >= visitLimit) break;
      const isItem = everyChild || !!group?.has(child);
      const d = visit(child as SwarmTroopersElement, parent, depth + 1, auto, isItem ? { prev, implicit } : null);
      if (isItem && d && (d.tool === 'frame' || d.tool === 'stamp')) prev = d;
    }
  };

  const visit = (
    el: SwarmTroopersElement,
    parent: Draft | null,
    depth: number,
    auto: boolean,
    item: { prev: Draft | null; implicit: boolean } | null,
  ): Draft | null => {
    if (visits >= visitLimit || out.length >= o.maxTasks || depth > 64 || SKIP.has(el.localName) || el.hasAttribute('data-swarmtroopers-skip')) return null;
    if (el.classList.contains('swarmtroopers-overlay') || el.classList.contains('swarmtroopers-controls')) return null;
    let ann: string | null = null;
    if (el.matches(o.selector)) ann = (el.getAttribute('data-swarmtroopers') || '').trim() || 'auto';
    else if (item?.implicit) ann = 'auto';
    if (ann === 'skip') return null;
    if (ann === 'scan') auto = true;
    // Annotated mode only pays for what it may build: the rest of the tree is walked without a style read.
    if (!ann && !auto) {
      walk(el, parent, depth, false, false, false);
      return null;
    }
    // Auto mode never hides essential controls, directly or through an enclosing task. A forced tool is the author's call.
    const forced = ann !== null && ann !== 'auto' && ann !== 'scan';
    const guarded = auto && !forced;
    if (guarded && el.matches(INTERACTIVE)) return null;
    // The budget counts style reads on elements not enrolled yet, so refresh() still reaches what was added since.
    if (!o.known?.(el)) visits++;

    const cs = getComputedStyle(el);
    if (cs.display === 'none') return null;
    // Opacity 0 means "not shown", except where we hid it ourselves: a known task, or the optional preload while it is on.
    const invisible = parseFloat(cs.opacity) === 0 && !o.known?.(el) && !(preloading && el.hasAttribute('data-swarmtroopers-preload'));
    if (auto && (cs.visibility !== 'visible' || invisible || cs.position === 'fixed' || cs.position === 'sticky')) return null;
    if (cs.display === 'contents') {
      walk(el, parent, depth, auto, false, false);
      return null;
    }
    const r = el.getBoundingClientRect();
    // Out of the page horizontally (marquee copies, off-canvas menus): leave it alone.
    if (auto && (r.right <= 0 || r.left >= vw)) return null;

    let name: string | null = null;
    let leaf = false;
    if (r.width >= 1 && r.height >= 1) {
      if (ann === 'repeat') name = hasBox(cs) && !isHuge(r, vw, vh) ? 'frame' : null;
      else if (forced) name = ann;
      // Focus reveals a forced task at once; an auto container holding a control stays visible, its content is still built.
      else if (!(guarded && el.querySelector(INTERACTIVE))) {
        const k = classify(el, cs, r, vw, vh);
        name = k.name;
        leaf = !k.recurse;
      }
    }
    // The second item of a list onwards is copied from the previous one.
    if (item && name === 'frame' && item.prev) name = 'stamp';
    const self = name ? add(el, name, parent, name === 'stamp' && item ? item.prev : null) : null;
    if (!leaf) walk(el, self ?? parent, depth, auto, ann === 'repeat', ann === 'repeat' && !auto);
    return self;
  };

  walk(root, null, 0, o.auto, false, false);
  return out;
}
