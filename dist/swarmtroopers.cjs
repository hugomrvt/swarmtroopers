/*! Swarm Troopers v0.5.1 | swarmtroopers | MIT */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SwarmTroopers: () => SwarmTroopers,
  controls: () => controls,
  create: () => create,
  defineTool: () => defineTool,
  tokens: () => tokens,
  version: () => version
});
module.exports = __toCommonJS(index_exports);

// src/util.ts
var clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
function rng(seed = Math.random() * 4294967296 >>> 0) {
  let s = seed >>> 0;
  const next = () => {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    chance: (p) => next() < p,
    /** Gaussian sample (Box-Muller). */
    normal: (mean = 0, sd = 1) => {
      let u = 0;
      while (u === 0) u = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    }
  };
}
var Emitter = class {
  constructor() {
    this.handlers = /* @__PURE__ */ new Map();
  }
  on(type2, fn) {
    let set = this.handlers.get(type2);
    if (!set) this.handlers.set(type2, set = /* @__PURE__ */ new Set());
    set.add(fn);
    return () => this.off(type2, fn);
  }
  off(type2, fn) {
    this.handlers.get(type2)?.delete(fn);
  }
  emit(type2, payload) {
    this.handlers.get(type2)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error("[swarmtroopers]", err);
      }
    });
  }
  clear() {
    this.handlers.clear();
  }
};
var storage = {
  get(area, key) {
    try {
      return (area === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(area, key, value) {
    try {
      (area === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
    } catch {
    }
  }
};
function debounce(fn, ms) {
  let timer;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  run.cancel = () => clearTimeout(timer);
  return run;
}

// src/motion.ts
function fitts(distance, width, a = 0.07, b = 0.12) {
  return a + b * Math.log2(Math.max(0, distance) / Math.max(4, width) + 1);
}
function minJerk(t) {
  const u = clamp(t, 0, 1);
  return u * u * u * (10 + u * (6 * u - 15));
}
function persona(r) {
  return {
    side: r.chance(0.7) ? 1 : -1,
    curve: r.range(0.05, 0.15),
    reach: r.range(0.9, 0.97),
    pace: r.range(0.85, 1.25)
  };
}
function segment(from, to, dur, bend, pause = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = bend * Math.min(len, 700);
  return {
    from,
    to,
    dur,
    pause,
    ctrl: { x: (from.x + to.x) / 2 - dy / len * off, y: (from.y + to.y) / 2 + dx / len * off }
  };
}
function planMove(from, to, p, r, o = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return [];
  const width = o.width ?? 18;
  const bend = p.curve * p.side * (o.drag ? 0.2 : 1);
  const total = fitts(d, width) * (o.drag ? 1.4 : 1) / p.pace;
  if (o.drag || d < 140) return [segment(from, to, Math.max(0.1, total), bend)];
  const ux = dx / d;
  const uy = dy / d;
  const lateral = clamp(r.normal(0, 0.02 * d), -0.05 * d, 0.05 * d);
  const reach = r.chance(0.25) ? r.range(1.02, 1.06) : p.reach;
  const mid = { x: from.x + dx * reach - uy * lateral, y: from.y + dy * reach + ux * lateral };
  const rest = Math.hypot(to.x - mid.x, to.y - mid.y);
  return [
    segment(from, mid, Math.max(0.1, total * 0.78), bend),
    segment(mid, to, Math.max(0.06, fitts(rest, width) * 0.8 / p.pace), bend * 0.3, r.range(0.02, 0.06))
  ];
}
function pointOn(s, t) {
  const k = minJerk(s.dur > 0 ? t / s.dur : 1);
  const m = 1 - k;
  return {
    x: m * m * s.from.x + 2 * m * k * s.ctrl.x + k * k * s.to.x,
    y: m * m * s.from.y + 2 * m * k * s.ctrl.y + k * k * s.to.y
  };
}
function typingBudget(chars, pace = 1) {
  return (0.35 + 0.42 * Math.log2(1 + Math.max(0, chars) / 12)) / pace;
}
function typingSchedule(text, duration, r) {
  const n = text.length;
  const weights = new Float32Array(n);
  let sum = 0;
  let word = 1;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    const starts = c !== " " && c !== "\n" && (i === 0 || text[i - 1] === " " || text[i - 1] === "\n");
    if (starts) word = r.range(0.7, 1.4);
    let w = c === " " ? 2.2 : c === "\n" ? 6 : ",;:".indexOf(c) >= 0 ? 4 : ".!?".indexOf(c) >= 0 ? 6 : word;
    if (starts && i > 0) w += r.range(0.5, 1.8);
    if (r.chance(0.03)) w += 5;
    w *= r.range(0.8, 1.2);
    weights[i] = w;
    sum += w;
  }
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weights[i] / (sum || 1) * duration;
    out[i] = acc;
  }
  return out;
}

// src/palette.ts
function oklchToRgb(l, c, hueDeg) {
  const h = hueDeg * Math.PI / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const linear = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S
  ];
  const out = [];
  for (const v of linear) {
    if (v < -5e-4 || v > 1.0005) return null;
    const x = Math.min(1, Math.max(0, v));
    out.push(Math.round((x <= 31308e-7 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255));
  }
  return out;
}
var toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
function buildPalette(spec = {}) {
  const { hue = 40, count = 8, lightness = 0.72, chroma = 0.16 } = spec;
  const out = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const h = ((hue + i * 137.508) % 360 + 360) % 360;
    let c = chroma;
    let rgb = oklchToRgb(lightness, c, h);
    while (!rgb && c > 0) {
      c = Math.max(0, c - 0.01);
      rgb = oklchToRgb(lightness, c, h);
    }
    out.push(toHex(rgb ?? [128, 128, 128]));
  }
  return out;
}
function relativeLuminance([r, g, b]) {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
var probe = null;
function cssToRgba(css) {
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return [255, 255, 255, 1];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
function pageBackground() {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const [r, g, b, a] = cssToRgba(getComputedStyle(el).backgroundColor);
    if (a > 0.5) return [r, g, b];
  }
  return [255, 255, 255];
}

// src/scan.ts
var SKIP = /* @__PURE__ */ new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "br",
  "wbr",
  "head",
  "title",
  "base",
  "source",
  "track",
  "param",
  "area",
  "map",
  "option",
  "optgroup",
  "datalist",
  "slot",
  "swarmtroopers-overlay"
]);
var MEDIA = /* @__PURE__ */ new Set(["img", "svg", "video", "canvas", "picture", "iframe", "object", "embed", "audio"]);
var FIELDS = /* @__PURE__ */ new Set(["input", "select", "textarea", "progress", "meter"]);
var INTERACTIVE = 'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable=false]),[tabindex]:not([tabindex^="-"]),[role=button],[role=link]';
function alphaOf(color) {
  if (!color || color === "transparent") return 0;
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)\s*$/);
  if (slash) return slash[2] ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
  const legacy = color.match(/^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/);
  if (legacy) return parseFloat(legacy[1]);
  return 1;
}
function hasBox(cs) {
  if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
  if (alphaOf(cs.backgroundColor) > 0.01) return true;
  if (cs.boxShadow && cs.boxShadow !== "none") return true;
  for (const side of ["top", "right", "bottom", "left"]) {
    const style = cs.getPropertyValue(`border-${side}-style`);
    if (style === "none" || style === "hidden") continue;
    if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && alphaOf(cs.getPropertyValue(`border-${side}-color`)) > 0.01) return true;
  }
  return false;
}
function textInfo(el) {
  let own = false;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3 && /\S/.test(n.nodeValue || "")) {
      own = true;
      break;
    }
  }
  for (const c of Array.from(el.children)) {
    if (SKIP.has(c.localName)) continue;
    const d = getComputedStyle(c).display;
    if (d === "none") continue;
    if (d !== "inline" && d !== "inline-block" && d !== "contents") return { own, flow: false };
  }
  return { own, flow: /\S/.test(el.textContent || "") };
}
var isHuge = (r, vw, vh) => r.height > vh * 0.9 || r.width >= vw * 0.96 && r.height >= vh * 0.6;
function classify(el, cs, r, vw, vh) {
  const tag2 = el.localName;
  if (MEDIA.has(tag2)) return { name: r.width * r.height < 1100 ? "instant" : "frame", recurse: false };
  if (FIELDS.has(tag2)) return { name: "frame", recurse: false };
  const box = hasBox(cs);
  const thin = r.height <= 3 && r.width >= 24 || r.width <= 3 && r.height >= 24;
  if (tag2 === "hr" || thin && box) return { name: "rule", recurse: false };
  const text = textInfo(el);
  if (text.flow) return { name: box ? "frame" : "type", recurse: false };
  if (box && !isHuge(r, vw, vh)) return { name: "frame", recurse: true };
  if (text.own) return { name: "type", recurse: true };
  return { name: null, recurse: true };
}
function repeatGroup(el, budget) {
  if (el.children.length > budget) return null;
  const kids = Array.from(el.children).filter((c) => !SKIP.has(c.localName));
  if (kids.length < 2) return null;
  const groups = /* @__PURE__ */ new Map();
  for (const c of kids) {
    const key = c.localName + "|" + Array.from(c.classList).filter((x) => !x.startsWith("swarmtroopers-")).sort().join(" ");
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  let best = [];
  for (const g of groups.values()) if (g.length > best.length) best = g;
  const min = /^(ul|ol|menu|dl)$/.test(el.localName) ? 2 : 3;
  return best.length >= min && best.length >= kids.length * 0.6 ? new Set(best) : null;
}
function scan(root, o) {
  const out = [];
  let visits = 0;
  const visitLimit = Math.max(100, o.maxTasks * 8);
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const preloading = document.documentElement.classList.contains("swarmtroopers-preload");
  const add = (el, tool, parent, source) => {
    const d = { el, tool, parent, source };
    out.push(d);
    return d;
  };
  const walk = (el, parent, depth, auto, everyChild, implicit) => {
    const group = auto && !everyChild ? repeatGroup(el, o.maxTasks - out.length) : null;
    let prev = null;
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (out.length >= o.maxTasks || visits >= visitLimit) break;
      const isItem = everyChild || !!group?.has(child);
      const d = visit(child, parent, depth + 1, auto, isItem ? { prev, implicit } : null);
      if (isItem && d && (d.tool === "frame" || d.tool === "stamp")) prev = d;
    }
  };
  const visit = (el, parent, depth, auto, item) => {
    if (visits >= visitLimit || out.length >= o.maxTasks || depth > 64 || SKIP.has(el.localName) || el.hasAttribute("data-swarmtroopers-skip")) return null;
    if (el.classList.contains("swarmtroopers-overlay") || el.classList.contains("swarmtroopers-controls")) return null;
    let ann = null;
    if (el.matches(o.selector)) ann = (el.getAttribute("data-swarmtroopers") || "").trim() || "auto";
    else if (item?.implicit) ann = "auto";
    if (ann === "skip") return null;
    if (ann === "scan") auto = true;
    if (!ann && !auto) {
      walk(el, parent, depth, false, false, false);
      return null;
    }
    const forced = ann !== null && ann !== "auto" && ann !== "scan";
    const guarded = auto && !forced;
    if (guarded && el.matches(INTERACTIVE)) return null;
    if (!o.known?.(el)) visits++;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;
    const invisible = parseFloat(cs.opacity) === 0 && !o.known?.(el) && !(preloading && el.hasAttribute("data-swarmtroopers-preload"));
    if (auto && (cs.visibility !== "visible" || invisible || cs.position === "fixed" || cs.position === "sticky")) return null;
    if (cs.display === "contents") {
      walk(el, parent, depth, auto, false, false);
      return null;
    }
    const r = el.getBoundingClientRect();
    if (auto && (r.right <= 0 || r.left >= vw)) return null;
    let name = null;
    let leaf = false;
    if (r.width >= 1 && r.height >= 1) {
      if (ann === "repeat") name = hasBox(cs) && !isHuge(r, vw, vh) ? "frame" : null;
      else if (forced) name = ann;
      else if (!(guarded && el.querySelector(INTERACTIVE))) {
        const k = classify(el, cs, r, vw, vh);
        name = k.name;
        leaf = !k.recurse;
      }
    }
    if (item && name === "frame" && item.prev) name = "stamp";
    const self = name ? add(el, name, parent, name === "stamp" && item ? item.prev : null) : null;
    if (!leaf) walk(el, self ?? parent, depth, auto, ann === "repeat", ann === "repeat" && !auto);
    return self;
  };
  walk(root, null, 0, o.auto, false, false);
  return out;
}

// src/scheduler.ts
function byPriority(a, b) {
  if (a.inView !== b.inView) return a.inView ? -1 : 1;
  return a.order - b.order;
}
function pickTask(sorted, from, k, anchor) {
  let best = null;
  let bestScore = Infinity;
  const n = Math.min(k, sorted.length);
  for (let i = 0; i < n; i++) {
    const p = anchor(sorted[i]);
    const score = Math.hypot(p.x - from.x, p.y - from.y) * (1 + i * 0.35);
    if (score < bestScore) {
      bestScore = score;
      best = sorted[i];
    }
  }
  return best;
}

// src/clap.ts
var CLAP_FRAMES = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAADQElEQVR4AeyXPY4TQRCFBw4A0sZkCBFtAEIiIeAcnIKjcArOQUCChCDYCCEy4pXgAqDP6KFyuae6umZsyzBIj/6pelXvdbe9u3en/+DfZvJfueTtJrebvKAT2J5rdFlfvn3/5RHlV2K+PutKndJNqtmzJ9eTQHPtM18C6gBqqD4ja+0zz6JkkuJqyhxoXREB34N6wO77tY1F87JJFf3541bT3a3+XRQn/pCo/+79h2K1P7Rhk14EZdYQQh1BNyZzT68fKbQbWxp2gZn/hk1SBxEYA6xPAfWi92i/IZP2BD/dfB3ttSjf97NaeoWHTFKscpLw1oCe76iGYZOI1dNhfkr4z2a2d8lktviaeVWDaEiZ5P0DCIDPx5Km1KiAvpZnNU2TjezPUyah8DkA53qqaACVz2XaJA0uFcMmeTLneKocMH0B8xEMm8wU57Ni0eOM5PZqteJdkwhoEaM9PrsCeVENxZTPCCcL8aP8rknIasyXTu+5kEsesFzmc4BDTBzmEcgD4kW5xFImScyC5tncVt5Sfqvm6iZbTc69t5nM3sC9+1fTyxfPJ/2gzvLm8vRkqTmXM7K/yk0iCtgvJYwj5OPnG4ZhUA8MExuEVUw26u5tPX744M7ehlvoIHQwLrx4eRKTkcreAUTcbOwoJnUjuqGMGOWKm+Fkc0KTmd8meo0yN5XJifr0dIYmKZz9rYLccyCjr2tSwrPfdHpuen7iZ0Zx+Esnk5/VlDaZaerFjTzDbG5Gh8+ZNdl7574Qa/3w1o2wNwq41PEH1qsT6W2aFEHvPfMsvKjKzVQ4aJNO6fYHcmBSiSJ6QmuNQU6fGDfBuBTUo262jvRKv+UdmCQoAnPAlwlg7tESUrkRW1cHFRlFjyCu1639pkkF/UhRv8caMYwSx7wKHdAataQhNPn67e1kAQmjAmtvUCKJVaEaGFV9aqkvI2s+jxbstRCa9ISWYZsjcXavOre1MAWsIebZ2kMmbVEMa82Ja36sccSU1xCafPPqagKe1Frbk2/Fj7nHLYO5Hk2T3IwAEaMtEDsVMDEHaWVs6TkwyY0IECD2QN6x0OtNnN7SzMja4sCkDULIwvLWmmd7kxf1DE1GxEuK/QYAAP//b2x0cwAAAAZJREFUAwCdRdhyePNCOwAAAABJRU5ErkJggg==",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAADe0lEQVR4AeyWPapUQRCFRxeg8GIzEaMXKIKJgetwFS7FVbgOAxNBNHiRiJnxA92A8g0cONZUV3fP3Dvj6AjH+unuU3Wqey7v7uY/+HcR+a9c8uUmLzd5RhO4PNczuqyy1e5Nfvn2/VdEybjyYuyFuFeyFCmCZ0+uNwKEyuMfC9QE1FMvWGLl8TOUIjkgop8/bgm3YnF6xOxZCqpFL0C9wE+MrdAV6Ychf/f+wx9C1YDvW9IXv8RQH356wY5gSiSET68fYbZCVXibWPE/r6P6M+WmRUKuaeIfE9ntffx8022hKVLPJGPYZ5oZTy/nPWQCe+e13hTJBj2TU92c94CfQT1ma8qVIqun4JP1iYt4bfvp5utwiabIxw8f3BHLyxfP5e7YkUnuHFol0SZtioxHZiYXz546boqMT/BYH5tsIP7TiOvVT0p7myLZoKd4ig9PHDL9OBg6falHX4t+KbI3JZ8wTYFYYJ9YPD0B1bfC6zZF+ofHD7h/7/7VNqQZQKAG8feBzosPDtXBF2a+EU2RIsNmE1Nhv01vjHP7QjxwA3hUD38WTZGa6AihGhnZW+3xmktxUq8pkkWfKHGFpZpSzVgr8vPhibl4RnEpUptmrd/I7Nm4/5BnKq5SZPV1bU2xdRMquKQdHUBTZO/rGgsorgYzIvDQ81mNpkjfLAGei77fbG9A8azH8SU4r++b8YdEZoQUB9na0rlD6zRFzn48Rm57afHwjTzvpkgI9HQOnSRcoxhpWlz0pR6Vy2wpcqZgRj6bm/0tj76eUuTIlFzIkkMZEcBNqn718ypFiqBn/Y/l2dvoccf1LO5dRiqymkpWJPsDPts3m/PhzZ71/TsiJVDT8SfhB+Uv1Yj4sHr2I8Pz/tQ7HI4dkSzOCFQjaozzh0DPXXwjQ0Soes6EpiLVJD9+oLhl1ZAabO0bzTsPQ2wJpTcBbgnFd5Qi2fj67e1GRLLk8WkAH3hjxEtAw/M61BVGa5QiEQgRViCmCBaoEfwlEYdGTcDTzFDVLkVmB12s1mNDyi9hfYiI24ezFPnm1dUGODEx8NxafhweNxlrkQPkfSDEQiqSzUCbECUodyqLIIf6UL9xMKzviGQTYJGDwH1iB2trw+u5T13F+Oob37EjUoscAMQQYYkzsLYWsnrkqBf7IpehKVKbIRSU+xusesL2+umK7BGcw/pvAAAA///AMDkbAAAABklEQVQDALX1yHKS6SmrAAAAAElFTkSuQmCC",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAADwElEQVR4AeyXPYpUQRSFny5AYWIzEaMJFMHEwHW4CpfiKlyHgYkgGkwkYmY8oBtQPpivuX27XvWt994MM9rCoW7d33Oqqp/M/ek/+HcS+a9c8ukmTzd5h07g9Fzv0GV1qW56k99+/PyT0Z1+Fcw17K9CmyybiZTYi2fnkxhhaA0rdfbDXotNREpIgpGUseiLditun1Ys1lbt1SIlIrHfvy4nAAF95uCL0G8edYAcfebgW4pVIiUgoQ8fP+14aBvbBZJh3HzC2sacQ2wJVolkoESwn58/YVmN2Cf2X9p4sch8uj6zpURyXe6X5+X83n6RSAd6yj6v1qDPXy9a7p2vF7evc5y7Ky4ai0TS28EQic+LWMbTx4/uZR/76H/96uX05eI77h3oS38czsMexWKRvUGQhXQvZ/vYfMdhkUufzDyFsciS+cMioRSfDk8K3xr0fpf0X/tkh0TGU2Rw/gLOCY11czk9fxRK3mi/IZEMiLfI/hjMbxHTZ07ld2zusbkxPiwyFs/ZkOWWATk9YsTIA+Ty0WLdEpuKfPDwbAISlmjvN2cOK3UcED3Yb4WySJ+Wg/mdaFfW+H9izq+IyvMyn9wz7ssiKcpPC18PFfK9+hzjpgE8iFWFlkRWmzF4LRBR6aHQSm5JJI2ONfXWqiTp2YP9ejnVWFlkpSH/d1byYk7ro7SkT+yZ7c1EcoP548Cwlgj8YO5jRB/6kbMFNhOZycTnNicm1sT86G/ZowdwVGT86Iw2791iJF/NizXa8APuW2tXpMV8dEYFOuzYLcb4yG3SH14Au4euSAorTciLGCUba6v2yKHPivQWq0PNU+DoEzTfevtV1x7fpkgLvMXqqWWC8Sn2yOa83CfWRlte8pR3zMFuiiRgIfYovJWbqMtCWzMPRMbToAFoFWZfPv18Ozk/73M+/ap/dkWOkb8zDkQS8BYZJPDPgRxjS28x1tuDP7t6QpkrqJd3FronMgcpFDTTjqt+iAFi+VbwVUAdINdec0KdS26EQqNvTyQBk96+v5wiiNFYsPeUJQRBQGwN7GHf2CvO55lGxLxoH4iMwWgrWB/DOGWJSMz42tV+9GcO8wB9FYZdwazId2/OJpCbIDb7JJT9a/f2Rai9EKjtinjgPq8HImPDnOxeoZVca5auCqW+JRB/RIvTnkgbkggo5jZbIAaswb5ucFstMBe+ADtz2hNpgkkURRC/LYi8sOEFb4AdcSDSIMkR+GkWge+mEOdiMzfyw8bXwqzInEyTFnLedexbc/FVZ5VFVhvexry/AAAA///9CctgAAAABklEQVQDANWGF4HdbHLXAAAAAElFTkSuQmCC",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAADTUlEQVR4AeyZTWpVQRCFny5AwbEzEUcZKIITB67DVbgUV+E6HDgRRAcZiThzHDAbSPgC51FpuvpW961KAolw7Prrqjpdfd+7jzw+3IN/DySzh/z7778Li+z8Xr4bn+Tb1ycH4DVUYb9xkhUktnKmk1y9jnYf8lbjM/50khTXdYw2qzj2AXJkooQkDc42OxtPjShKSP74dXqsrynJgA9I7/nly1rTSb568fwRzUGknQ4+C+KA4tiDTgxrFtJJ0piaVNNMywPxxAFk7UXOQglJmqNZgMykBHQgnRWdWICcjTKSNMr0WCOYiY3kszGlJCnEpM7/nx2A9J4NXxXKSLaTefL02TUO6MAa2z3Wt0cuI0lTTIwVMEmADJAFdBuLnokSknYiX799n+rX7p3aOAguIUk9TebNyUvUK/w8/XO18p+VmSg27UGeh7+jjCQlZ6Y4E0vuGZSSnGmkMjadZMYzlZHDHlo6SZLzbHH97POIfQRi2cPeUdyKr4RkrxG+Ez+8f3d0IWM7GgqFVJLeNRuR8XxerpWzSCOpprzrpq8JNdnq2LmyrF4OfCtII0lxNQcBNYxdwC7ZWyMx3l7PnkpSvwm9YrdlTyNZ9Vsw42DSSHrN8MHCV0PPr6tJTM+fZUshyYcO6DUFkd7zqVj8QLpdvZw2JiKnkKQQHzoAOQOZudJIipg3Ffz2l4eV8VmMcti4qJxO0is8IuXtybLvJpn13HiEMvLvJklzen62rhnvq8QDK6O3IJfytr5ZfRfJjFOONGzrROLbmGWSKqzT5uTb5Fv61nNKTuVXva2cPf8ySZKpAeQt6Hry6geIlw15hJk6vTxLJNtT5cR7yWUbvdFEpqk81AXSo+sSSZLb042S0ATZL5lpekTJC4inHkCexTLJtpCaae2QwCZSvMgDa0OuxG6Sn76cHQBNQlSQzmoJogNLlIPQNLWflcdAYM8qdpNUYRGVTpOSWUUKWbA2iLZ7FLd3TSNJIxAFyIKmKL232hhNjrUXu2JbJqnGPn+8/tcqmmiJ2onht7A+j5gmrJp2f0ReIqnGVBSiLSLF2xjI9EAdQLxqI0exRJLkKkbxEYiNYCsH9UAkVxuzTJJEFI2A2BEycozy7yI5SnyXfJcAAAD//1wG1YYAAAAGSURBVAMAsm3UchpJpQcAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAADa0lEQVR4AeyYPY4UMRCFBw4A0sZkCBFtAEIiIeAcnIKjcArOQUCChCDYCCEy4pXgArAf8FrVNWW77O7pnWUH8bBdv++5PAPs3d0t+HUS+b8M+TTJ0yRv0A2cnusNGlaV6tAkv3z7/suj2mXA6etzHijzJ6VbpJo9e3K+E6gkO/u1oPqs1Bzt0S2SZmrKHvgztiWIxCzp0SXSN//543KmxftnzuRBNSSKHkDp8uucWbtEUtA25ywCsmNbCtV69/7DVIq97JMxuUmLHLnBJIdU2NPzR1NcL5e0SDroJjU9bJ8uvrJsgtFppkT23txSxR8/XzRL9HBKiaSjpsj+kHj88MGdVn1xyQpNi1Rj+1Rl22rlc8mTpZ+Esv+L8p9dItWgXO44PU2R2SeR+Rxd1xU0RUKs52lwKYC8XpAHlPfyxXNtp5UnOx2uNjb+6hj+Tokkk6fqG2AXuAhBtp5VZDM14EJtYllbSItsFfJfSCLdyrP+LGmbk9lXRWaI8qQkUOsSstQQEHDv/hnLDLUXNQv8d6iKJGYJYfKPAUWRfoq9tzcqLppcq5bn6uOLIgnUFHk+nLPY4q8TcRLHGreqyFoivtqtZ/55Ro0tsEgkBPV1zn5taFqly5S/1XeRSJrYz2qJTItEzU8PUItp+RaJbBXv9euzvPZlhSJb31YReRET0SimZtNneDS/xjkUCRl9a408FRGmTg9G88S11KsospQQ2TXFyDdqy9bMDGFPZG3sLcKjT83XHa1T4j4TqSCNP3NLnuDok1OdVr7i/CrO3s55JhKDgrMC9axGb5+eEain2pHf2ixXBgWsfxJpHTbJBvu9JzE6BV/X1vE9fKzOcGZAAJvVM4nEoQAKC9gj2J+3cutRzFY2z1U61H8mUsaeVQLt7ffk12JVGxGluJpPOXsiX7+93FlQRFASU+Q/yzofQqBqRkLFhxUOPFWBs8eeSB+AYNkoCiRQBORfe5VQ1aU30JkVcaw17Il88+psB2wSQoG1SaAnYmPW2quXrYc4YG3+AuSbiYyKKZBVQhW3hUD1UE94eHHYrEAbi28SaYsRxDQjkAQUz/7Q8L0Q5AEHeAP2NmcSKYecBHsQc0yI+MEfWJ4zkXIQ5IFPRdlfB9RfKxwintgtQpE2QPtMMcUeYvX9dc70SovMFDvWmN8AAAD///1YJKUAAAAGSURBVAMAG0zDchYmW8kAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAxCAYAAABgSwHoAAAC+0lEQVR4AeyXPW5VMRCFLywApNR0CFGlACHRULAOVsFSWAXroKBBQlCkQoiOOhJsAPRF+iLHz9fXY/tG+XmRTsYez5yZ8+b65uXhcg9+jiLvypCPkzxO8hZ9AsfH9RYNq9rqLpP88ev3vxS1DtI417X4nrPpImmURl69OF0Aa32sU+gnTnCun/UMTBVpczRsc64906/1fG2vf8ROFUkjNv3p85fl759zXMWJ5qKNvUiY/GuayLzpl6fPLlpFLAvFsxb6SgJzPnN67DSRFK81zfkWEAvk2YpvPZ8iMv/Uv539bK1/EJfm5rwHwY2OKSKp5afPJNiPAA75RnjMnSZSwptoh0XmjxSPmy+dHsHkwmFuzq//0K57hkVCPfPRgk/M4p0i0qa4S65H7UyuqSJHhe2VP1Ukd4k7tdXs1j2DA64tntbzIZFbzdLE2zevMZcwJ3LfzLkkCS6GRFLLZrlDTADfGoz1nBzWjx6fYK5ArjznSlDjZlhkrY7NIwYQS9PAvdZYYoRn7nvtriJ7m5qddxQ58omWHr8RvpHc3SfZcq/8n3NESC13N5GIA7XinvEmbY01J2J3ExlpYu/YaxOZf4PJ93sK7RY5+i0kKmqkXrdImuSPOrYFfr37+v1sAe5bciN1SnxDIiXc86Uxg3uKSMVGbc/f0mgN4rtERu+HYnhMKQrSNfsWROvKGRZpIe9J9HF6/vTJA2ADLW9ZaljP+ua32LBISC1IcfY1KKI0OXy8gIyp8XBm3ajQkMgoOc0jggZBOsF0TQyxxGxBoVtx6XlIJIlpEe6a4GwNTKznTG7sWn6LPyxS0vcfz5cUNCKMYUIKTCfneeojFr8cWPZciRT4ougWmRcqCTYmFaOvZEvCSnFR3zSR0cJpvNPGx9SwM9Et8sO7kwWUmmGq+NPm2ZcQmbKTLvHUfGGRNC4gRmgJnIFWEcQChJRgTSxxEYRE0rCgCAVrIKYVNR7O4LE2ln0rQiJTUgq1IM1ZW7fwELOWv+XvFrlFfJPO/wMAAP//N5Os1wAAAAZJREFUAwDAm51yS402PgAAAABJRU5ErkJggg=="
];
var CLAP_TIMES = [0, 0.3, 0.62, 0.86, 1.1, 1.36];

// src/overlay.ts
var LEAD = 1.2;
var MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
var F = { veil: 0.24, enter: 0.12, meet: 0.86, hold: 3.12, out: 0.42 };
var FINALE_END = F.hold + F.out;
var FINALE_OUT = 0.3;
var unit = (t) => Math.min(1, Math.max(0, t));
var easeOut = (t) => 1 - Math.pow(1 - unit(t), 3);
function finalePose(age) {
  const approach = easeOut((age - F.enter) / 0.4);
  const strike = unit((age - 0.66) / (F.meet - 0.66));
  const settle = unit((age - F.meet - 0.06) / 0.5);
  const recoil = Math.sin(settle * Math.PI) * Math.exp(-settle * 2);
  return {
    spread: age < 0.66 ? 12 + 74 * (1 - approach) : age < F.meet ? 12 * (1 - strike * strike) : 3.5 * recoil,
    tilt: age < F.meet ? -0.18 * (1 - strike) : 0.035 * recoil,
    lift: age < F.meet ? 9 * Math.sin(approach * Math.PI) : 5 * recoil,
    impact: age >= F.meet ? 1 - unit((age - F.meet) / 0.46) : 0
  };
}
var Overlay = class {
  constructor(z, cap) {
    this.cap = cap;
    this.clap = [];
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.painted = true;
    this.widths = /* @__PURE__ */ new Map();
    this.wraps = /* @__PURE__ */ new Map();
    this.contrast = /* @__PURE__ */ new Map();
    this.st = { halo: "#fff", ink: "#111", sans: "system-ui, sans-serif", scale: 1 };
    /** Opacity of the working troopers as the completion stage enters. */
    this.mul = 1;
    const c = document.createElement("canvas");
    c.className = "swarmtroopers-overlay";
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
    document.body.appendChild(c);
    try {
      const origin = c.getBoundingClientRect();
      const viewport = (document.compatMode === "BackCompat" ? document.body : document.documentElement).clientHeight;
      if (Math.abs(origin.x) > 1 || Math.abs(origin.y) > 1 || Math.abs(origin.width - c.clientWidth) > 1 || Math.abs(origin.height - c.clientHeight) > 1 || Math.abs(c.clientHeight - viewport) > 1) throw new Error("[swarmtroopers] a transformed document prevents viewport overlay alignment");
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("[swarmtroopers] 2D canvas is not available");
      this.canvas = c;
      this.ctx = ctx;
      this.dart = new Path2D("M0 0 L5.1 17.4 Q5.4 18.5 6.2 17.6 L9.5 12.2 L15.2 10.5 Q16.4 10.1 15.2 9.4 Z");
      this.palm = new Path2D("M-4 13 L-4.7 8 Q-5 6-7 4 L-10.3-0.3 Q-11.8-2.6-9.8-3.4 Q-8.5-3.9-7.1-2 L-5.7-0.1 L-6.2-10 Q-6.3-12.8-4.4-12.8 Q-2.6-12.8-2.5-10 L-2.1-4.3 L-2.2-14 Q-2.2-16.7-0.2-16.7 Q1.7-16.7 1.7-14 L1.7-4.8 L2.3-12.3 Q2.5-14.8 4.3-14.4 Q6-14.2 5.8-11.8 L5.2-3.4 L6.2-8.5 Q6.7-10.7 8.3-10.1 Q9.7-9.6 9.2-7.4 L7.6 0.8 Q7.2 3.2 6.4 5.2 Q5.5 7.7 5.2 13 Z");
      this.slap = new Path2D("M0 7 L0-14.5 C0-18.8-4.2-18.8-4.8-14.5 L-5.8-5.8 L-5.8-12.1 C-5.8-15.5-9.3-15.5-9.9-12.1 L-11-4 L-11-8.7 C-11-11.8-14.2-11.8-14.7-8.5 L-15.6-0.5 L-15.8-4.9 C-16-7.3-18.5-7.1-18.6-4.4 L-18.6 2 L-21-0.5 C-23.2-2.7-25.6 0-23.4 2.5 L-17.8 9 C-16.7 10.3-15.1 11.7-14.7 13.5 L-17.3 17 L-9 21 L-4.6 14.4 C-1.6 12.4 0 10.7 0 7 Z");
      this.resize();
    } catch (error) {
      c.remove();
      throw error;
    }
  }
  prepareFinale() {
    if (this.clap.length) return;
    this.clap = CLAP_FRAMES.map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      void image.decode().catch(() => void 0);
      return image;
    });
  }
  setCap(cap) {
    this.cap = cap;
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(this.cap, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.painted = true;
  }
  destroy() {
    this.canvas.remove();
  }
  render(anns, agents, sx, sy, style, fin = null) {
    const { ctx } = this;
    this.st = style;
    const halo = style.halo;
    this.mul = fin ? 1 - Math.min(1, fin.age / F.veil) : 1;
    if (!anns.length && !agents.length && !fin) {
      if (this.painted) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.painted = false;
      }
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const n of anns) this.annotation(n, sx, sy, halo);
    for (const a of agents) this.pointer(a, sx, sy, halo);
    const lead = agents.find((x) => x.lead);
    const near = 46 * style.scale;
    for (const a of agents) {
      if (!a.name) continue;
      if (lead && a !== lead && Math.abs(a.x - lead.x) < near && Math.abs(a.y - lead.y) < near) continue;
      this.tag(a, sx, sy);
    }
    for (const a of agents) if (a.say) this.bubble(a, sx, sy);
    this.mul = 1;
    if (fin) this.finale(fin);
    ctx.globalAlpha = 1;
    this.painted = true;
  }
  /** The closing clap: two pixel cursor hands high five where the orchestrator stood. */
  finale(f) {
    this.prepareFinale();
    const { ctx } = this;
    const out = f.close ? unit(f.close / FINALE_OUT) : unit((f.age - F.hold) / F.out);
    const life = (1 - out) * easeOut(f.age / F.veil);
    if (life <= 0) return;
    const z = 2;
    const size = 49 * z;
    const mx = Math.min(this.w / 2, size + 64);
    const cx = Math.min(this.w - mx, Math.max(mx, f.at.x));
    const cy = Math.min(this.h - size - 30, Math.max(size, f.at.y));
    const sprite = this.clap.every((image) => image.complete && image.naturalWidth > 0);
    ctx.save();
    ctx.globalAlpha = life * easeOut((f.age - F.enter) / 0.18);
    if (sprite) {
      let i = 0;
      while (i < CLAP_TIMES.length - 1 && f.age >= CLAP_TIMES[i + 1]) i++;
      const hit = f.age - CLAP_TIMES[3];
      const shake = i === 3 && hit < 0.08 ? Math.floor(hit / 0.04) % 2 ? z : -z : 0;
      const image = this.clap[i];
      const w = image.naturalWidth * z;
      const h = image.naturalHeight * z;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, Math.round(cx - w / 2 + shake), Math.round(cy - h / 2), w, h);
    } else {
      const v = 76;
      const pose = finalePose(f.age);
      const s = v / 100;
      const pop = 1 + 0.1 * pose.impact;
      const k = v / 46;
      for (const [side, color] of [[-1, f.left.color], [1, f.right.color]]) {
        ctx.save();
        ctx.translate(cx + side * pose.spread * s, cy + 6 * k + pose.lift * s);
        ctx.rotate(side * pose.tilt);
        ctx.scale(side > 0 ? -k * pop : k * pop, k * pop);
        this.highFiveHand(color);
        ctx.restore();
      }
      if (pose.impact > 0) {
        const t = 1 - pose.impact;
        ctx.globalAlpha = life * pose.impact;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const oy = cy - v * 0.42;
        for (let i = 0; i < 7; i++) {
          const angle = -Math.PI / 2 + (i - 3) * 0.42;
          const r = v * (0.3 + 0.25 * easeOut(t));
          const len = v * 0.16 * (1 - t);
          ctx.strokeStyle = i % 2 ? f.left.color : f.right.color;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r, oy + Math.sin(angle) * r);
          ctx.lineTo(cx + Math.cos(angle) * (r + len), oy + Math.sin(angle) * (r + len));
          ctx.stroke();
        }
      }
    }
    const tagsY = cy + size / 2 + 4;
    const nameFont = `600 12px ${this.st.sans}`;
    for (const [i, agent] of [f.left, f.right].entries()) {
      if (!agent.name) continue;
      const name = this.fit(agent.name, nameFont, 120);
      const tw = this.measure(name, nameFont) + 16;
      const x = i ? cx + 3 : cx - 3 - tw;
      ctx.globalAlpha = life * easeOut((f.age - 0.3) / 0.2);
      ctx.fillStyle = agent.color;
      roundRect(ctx, x, tagsY, tw, 21, 5);
      ctx.fill();
      ctx.font = nameFont;
      ctx.fillStyle = this.textOn(agent.color);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, x + tw / 2, tagsY + 11);
    }
    ctx.restore();
  }
  measure(text, font) {
    const key = font + "|" + text;
    let w = this.widths.get(key);
    if (w === void 0) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      if (this.widths.size > 2e3) this.widths.clear();
      this.widths.set(key, w);
    }
    return w;
  }
  /** Dark or light text, whichever reads better on the agent colour. */
  textOn(color) {
    let c = this.contrast.get(color);
    if (!c) {
      const [r, g, b] = cssToRgba(color);
      const luminance = relativeLuminance([r, g, b]);
      c = (luminance + 0.05) / (relativeLuminance([13, 14, 17]) + 0.05) >= 1.05 / (luminance + 0.05) ? "#0d0e11" : "#ffffff";
      this.contrast.set(color, c);
    }
    return c;
  }
  fit(text, font, width) {
    if (this.measure(text, font) <= width) return text;
    const chars = Array.from(text);
    let low = 0;
    let high = chars.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.measure(chars.slice(0, mid).join("") + "\u2026", font) <= width) low = mid;
      else high = mid - 1;
    }
    return chars.slice(0, low).join("").trimEnd() + "\u2026";
  }
  /** A presence tab and a separate task caption keep identity stable while work changes. */
  tag(a, sx, sy) {
    const k = this.st.scale * (a.lead ? LEAD : 1);
    const { ctx } = this;
    const base = a.dim ? Math.max(0.85, a.alpha) : a.alpha;
    if (base <= 0.02 || a.shape === "hand" && !a.lead) return;
    const font = `650 ${(10.5 * k).toFixed(1)}px ${this.st.sans}`;
    const taskFont = `500 ${(10 * k).toFixed(1)}px ${this.st.sans}`;
    const max = Math.max(32, Math.min(220 * k, this.w - 24));
    const name = this.fit(a.name, font, max - 18 * k);
    const h = 20 * k;
    const w = this.measure(name, font) + 18 * k;
    const doing = a.doing;
    const caption = doing ? this.fit(doing.text, taskFont, max - 16 * k) : "";
    const ta = doing ? Math.min(easeOut(doing.age / 0.18), unit((2.8 - doing.age) / 0.25)) : 0;
    const tw = caption ? this.measure(caption, taskFont) + 16 * k : 0;
    const stacked = this.w < 600 || w + tw + 5 * k > max;
    const totalW = stacked ? Math.max(w, tw) : w + (tw ? tw + 5 * k : 0);
    const totalH = h + (stacked && tw ? h + 4 * k : 0);
    const px = a.x - sx;
    const py = a.y - sy;
    if (px < -40 || py < -40 || px > this.w + 40 || py > this.h + 40) return;
    let x = px + 12 * k;
    if (x + totalW > this.w - 8) x = px - totalW - 5 * k;
    x = Math.max(8, Math.min(this.w - totalW - 8, x));
    const y = Math.max(8, Math.min(this.h - totalH - 8, py + 18 * k));
    ctx.save();
    ctx.globalAlpha = this.mul * base;
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - 5 * k, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + 5 * k);
    ctx.lineTo(x + w, y + h - 5 * k);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 5 * k, y + h);
    ctx.lineTo(x + 5 * k, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 5 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.textOn(a.color);
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.fillText(name, x + 9 * k, y + h / 2 + 0.5);
    if (caption && ta > 0) {
      const tx = stacked ? x : x + w + 5 * k;
      const ty = y + (stacked ? h + 4 * k : 0) + (1 - ta) * 3 * k;
      ctx.globalAlpha = this.mul * base * ta;
      ctx.fillStyle = this.st.halo;
      roundRect(ctx, tx, ty, tw, h, 5 * k);
      ctx.fill();
      ctx.globalAlpha *= 0.28;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = this.mul * base * ta;
      ctx.fillStyle = this.st.ink;
      ctx.font = taskFont;
      ctx.fillText(caption, tx + 8 * k, ty + h / 2 + 0.5);
    }
    ctx.restore();
  }
  wrap(text, font, max) {
    const key = font + "|" + max + "|" + text;
    let lines = this.wraps.get(key);
    if (lines) return lines;
    lines = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const next = cur ? cur + " " + word : word;
      if (cur && this.measure(next, font) > max) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    lines = lines.map((line) => this.fit(line, font, max));
    if (this.wraps.size > 500) this.wraps.clear();
    this.wraps.set(key, lines);
    return lines;
  }
  /** Speech bubble above the name tag, with a tail pointing at the agent. */
  bubble(a, sx, sy) {
    const say = a.say;
    if (!say) return;
    const k = this.st.scale;
    const { ctx } = this;
    const font = `500 ${(12.5 * k).toFixed(1)}px ${this.st.sans}`;
    const lines = this.wrap(say.text, font, Math.min(200 * k, this.w - 40 * k));
    const lh = 16.5 * k;
    const padX = 11 * k;
    const padY = 8 * k;
    const w = Math.max(...lines.map((l) => this.measure(l, font))) + padX * 2;
    const h = lines.length * lh + padY * 2;
    const px = a.x - sx;
    const py = a.y - sy;
    let x = px + 14 * k;
    if (x + w > this.w - 8) x = px - w - 6 * k;
    x = Math.max(8, Math.min(this.w - w - 8, x));
    let y = py - h - 10 * k;
    if (y < 8) y = py + 40 * k;
    y = Math.max(8, Math.min(this.h - h - 8, y));
    if (x > this.w || y > this.h || x + w < 0 || y + h < 0) return;
    const appear = Math.min(1, say.age / 0.16);
    const leave = Math.min(1, Math.max(0, (say.ttl - say.age) / 0.25));
    const alpha = Math.min(appear, leave);
    const grow = 0.96 + 0.04 * easeOut(appear);
    ctx.save();
    ctx.globalAlpha = this.mul * alpha;
    const ox = x < px ? x + w : x;
    const oy = y < py ? y + h : y;
    ctx.translate(ox, oy);
    ctx.scale(grow, grow);
    ctx.translate(-ox, -oy);
    const r = Math.min(8 * k, h / 2);
    const tailX = x < px ? x + w - 14 * k : x + 14 * k;
    const tailY = y < py ? y + h : y;
    const dir = y < py ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(tailX - 5 * k, tailY);
    ctx.lineTo(tailX + (x < px ? 4 : -4) * k, tailY + dir * 7 * k);
    ctx.lineTo(tailX + 5 * k, tailY);
    ctx.closePath();
    ctx.fillStyle = a.color;
    ctx.fill();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = this.st.halo;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = a.color;
    ctx.stroke();
    ctx.fillStyle = this.st.ink;
    ctx.font = font;
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, x + padX, y + padY + lh * (i + 0.5)));
    ctx.restore();
  }
  annotation(n, sx, sy, halo) {
    const { ctx } = this;
    const alpha = 1 - Math.min(1, n.out);
    if (alpha <= 0) return;
    ctx.globalAlpha = this.mul * alpha;
    ctx.strokeStyle = n.color;
    ctx.fillStyle = n.color;
    switch (n.kind) {
      case "drag":
      case "ghost": {
        if (!n.rect) return;
        const r = normalise(n.rect());
        const x = r.x - sx;
        const y = r.y - sy;
        if (!this.onScreen(x, y, r.w, r.h)) return;
        ctx.globalAlpha = this.mul * alpha * (n.kind === "ghost" ? 0.1 : 0.07);
        ctx.fillRect(x, y, r.w, r.h);
        ctx.globalAlpha = this.mul * alpha * (n.kind === "ghost" ? 0.75 : 1);
        ctx.lineWidth = 1;
        ctx.setLineDash(n.kind === "ghost" ? [4, 3] : []);
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
        ctx.setLineDash([]);
        if (n.kind === "drag" && r.w > 10 && r.h > 10) this.handles(x, y, r.w, r.h, n.color, halo);
        return;
      }
      case "select": {
        if (!n.rect) return;
        const r = n.rect();
        const x = r.x - sx;
        const y = r.y - sy;
        if (!this.onScreen(x, y - 24, r.w, r.h + 48)) return;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
        this.handles(x, y, r.w, r.h, n.color, halo);
        if (n.label) this.label(n.label, x, y + r.h + 6, y - 28, n.color, halo, alpha);
        return;
      }
      case "line": {
        if (!n.a || !n.b) return;
        const a = n.a();
        const b = n.b();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x - sx, a.y - sy);
        ctx.lineTo(b.x - sx, b.y - sy);
        ctx.stroke();
        return;
      }
      case "caret": {
        if (!n.a || !n.b) return;
        const a = n.a();
        const b = n.b();
        ctx.fillRect(a.x - sx - 1, a.y - sy, 2, Math.max(2, b.y - a.y));
        return;
      }
      case "zone": {
        if (!n.rect) return;
        const r = normalise(n.rect());
        const x = r.x - sx;
        const y = r.y - sy;
        if (!this.onScreen(x, y, r.w, r.h)) return;
        ctx.globalAlpha = this.mul * alpha * 0.45;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        roundRect(ctx, x + 0.5, y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1), 6);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      case "spark": {
        if (!n.a) return;
        const p = n.a();
        const t = Math.min(1, n.age / Math.max(0.01, n.ttl));
        const k = this.st.scale;
        const ease = 1 - (1 - t) * (1 - t);
        ctx.globalAlpha = this.mul * alpha * (1 - t);
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = -Math.PI / 2 + (i - 2) * 0.55;
          const r0 = (6 + 8 * ease) * k;
          const r1 = r0 + 5 * k * (1 - t * 0.6);
          ctx.moveTo(p.x - sx + Math.cos(ang) * r0, p.y - sy + Math.sin(ang) * r0);
          ctx.lineTo(p.x - sx + Math.cos(ang) * r1, p.y - sy + Math.sin(ang) * r1);
        }
        ctx.stroke();
        return;
      }
      case "ripple": {
        if (!n.a) return;
        const p = n.a();
        const k = Math.min(1, n.age / Math.max(0.01, n.ttl));
        ctx.globalAlpha = this.mul * alpha * (1 - k) * 0.8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x - sx, p.y - sy, (3 + 13 * k) * this.st.scale, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
    }
  }
  handles(x, y, w, h, color, halo) {
    const { ctx } = this;
    const size = Math.max(4, Math.min(5.5, this.st.scale * 4.5));
    ctx.fillStyle = halo;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (const [hx, hy] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) {
      ctx.fillRect(hx - size / 2, hy - size / 2, size, size);
      ctx.strokeRect(hx - size / 2, hy - size / 2, size, size);
    }
  }
  label(text, x, below, above, color, halo, alpha) {
    const { ctx } = this;
    const s = Math.min(1.3, this.st.scale);
    const font = `500 ${(10 * s).toFixed(1)}px ${MONO_STACK}`;
    ctx.font = font;
    const content = this.fit(text, font, Math.max(16, this.w - 24 * s));
    const w = Math.ceil(this.measure(content, font)) + 12 * s;
    const h = 17 * s;
    const lx = Math.min(Math.max(4, x), this.w - w - 4);
    const ly = Math.max(4, Math.min(this.h - h - 4, below + h > this.h - 4 && above > 4 ? above : below));
    ctx.globalAlpha = this.mul * alpha * 0.92;
    ctx.fillStyle = halo;
    roundRect(ctx, lx, ly, w, h, 4);
    ctx.fill();
    ctx.globalAlpha = this.mul * alpha;
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    roundRect(ctx, lx + 0.5, ly + 0.5, w - 1, h - 1, 4);
    ctx.stroke();
    ctx.fillStyle = this.st.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(content, lx + 6 * s, ly + h / 2 + 0.5);
  }
  pointer(a, sx, sy, halo) {
    const x = a.x - sx;
    const y = a.y - sy;
    if (a.alpha <= 0.01 || x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = this.mul * a.alpha;
    ctx.translate(x, y);
    const s = (1 - a.press * 0.12) * this.st.scale * (a.lead ? LEAD : 1);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (a.shape === "hand") {
      ctx.scale(1.3, 1.3);
      this.hand(a.flip, a.color, halo);
    } else if (a.shape === "beam" || a.shape === "cross") {
      ctx.beginPath();
      if (a.shape === "beam") {
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(-3.5, -8);
        ctx.lineTo(3.5, -8);
        ctx.moveTo(-3.5, 8);
        ctx.lineTo(3.5, 8);
      } else {
        ctx.moveTo(-8, 0);
        ctx.lineTo(-2.5, 0);
        ctx.moveTo(2.5, 0);
        ctx.lineTo(8, 0);
        ctx.moveTo(0, -8);
        ctx.lineTo(0, -2.5);
        ctx.moveTo(0, 2.5);
        ctx.lineTo(0, 8);
      }
      ctx.strokeStyle = halo;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (a.shape === "cross") {
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = halo;
      ctx.lineWidth = 2;
      ctx.stroke(this.dart);
      ctx.fillStyle = a.color;
      ctx.fill(this.dart);
      if (a.shape === "stamp") {
        roundRect(ctx, 9, 10, 9, 9, 2);
        ctx.fillStyle = a.color;
        ctx.fill();
        ctx.strokeStyle = halo;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(13.5, 12.2);
        ctx.lineTo(13.5, 16.8);
        ctx.moveTo(11.2, 14.5);
        ctx.lineTo(15.8, 14.5);
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  /** Three-quarter hands share a straight contact edge, with the thumbs and wrists facing out. */
  highFiveHand(color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.fill(this.slap);
    ctx.strokeStyle = this.textOn(color);
    ctx.lineWidth = 0.65;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha *= 0.28;
    ctx.beginPath();
    ctx.moveTo(-4.8, -13);
    ctx.lineTo(-6.2, 2.8);
    ctx.moveTo(-9.7, -10.5);
    ctx.lineTo(-11.6, 3.7);
    ctx.moveTo(-14.5, -7.2);
    ctx.lineTo(-15.3, 3.7);
    ctx.moveTo(-3.5, 5.7);
    ctx.quadraticCurveTo(-7.7, 4.8, -10.8, 7.3);
    ctx.stroke();
    ctx.globalAlpha /= 0.28;
    ctx.fillStyle = this.st.halo;
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(-15.5, 14.4);
    ctx.lineTo(-6.6, 18);
    ctx.lineTo(-8.4, 20.7);
    ctx.lineTo(-17.1, 17.1);
    ctx.closePath();
    ctx.fill();
  }
  /** One continuous outline keeps the palm and its five fingers readable even at cursor size. */
  hand(flip, color, halo) {
    const { ctx } = this;
    ctx.scale(flip ? -1 : 1, 1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = halo;
    ctx.lineWidth = 1.2;
    ctx.stroke(this.palm);
    ctx.fillStyle = color;
    ctx.fill(this.palm);
    ctx.strokeStyle = this.textOn(color);
    ctx.globalAlpha *= 0.34;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(-0.5, -0.5, 3, 1);
    ctx.moveTo(-2.8, 5);
    ctx.quadraticCurveTo(-1, 3.2, 2, 4);
    ctx.moveTo(-3.6, 10);
    ctx.lineTo(4.7, 10);
    ctx.stroke();
  }
  onScreen(x, y, w, h) {
    return x + w >= -20 && y + h >= -20 && x <= this.w + 20 && y <= this.h + 20;
  }
};
function normalise(r) {
  return { x: r.w < 0 ? r.x + r.w : r.x, y: r.h < 0 ? r.y + r.h : r.y, w: Math.abs(r.w), h: Math.abs(r.h) };
}
function roundRect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// src/text.ts
function bandsFor(lines) {
  const order = lines.map((_, i) => i).sort((i, j) => lines[i].top - lines[j].top);
  const bands = new Array(lines.length);
  order.forEach((li, k) => {
    const cur = lines[li];
    if (k === 0) {
      bands[li] = cur.top;
      return;
    }
    const prev = lines[order[k - 1]];
    bands[li] = prev.bottom > cur.top ? (prev.bottom + cur.top) / 2 : cur.top;
  });
  return bands;
}
function clipAt(g, chars) {
  const ps = g.pieces;
  const c = clamp(chars, 0, g.seq.length);
  let lo = 0;
  let hi = ps.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (ps[mid].b <= c) lo = mid + 1;
    else hi = mid;
  }
  const p = ps[lo];
  const f = clamp((c - p.a) / Math.max(1, p.b - p.a), 0, 1);
  const x = p.x0 + (p.x1 - p.x0) * f;
  const line = g.lines[p.line];
  const top = g.bands[p.line];
  const L = -g.pad;
  const T = -g.pad;
  const R = g.w + g.pad;
  const px = (v) => Math.round(v * 10) / 10 + "px";
  return {
    path: `polygon(${px(L)} ${px(T)},${px(R)} ${px(T)},${px(R)} ${px(top)},${px(x)} ${px(top)},${px(x)} ${px(line.bottom)},${px(L)} ${px(line.bottom)})`,
    x,
    top: line.top,
    bottom: line.bottom
  };
}
var WORD = /\S+/g;
function measureText(el, skip) {
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  const raw = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (skip(node)) continue;
    const data = node.data;
    WORD.lastIndex = 0;
    for (let m = WORD.exec(data); m; m = WORD.exec(data)) {
      const word = m[0];
      range.setStart(node, m.index);
      range.setEnd(node, m.index + word.length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      if (rects.length === 1) {
        raw.push({ text: word, r: rects[0] });
        continue;
      }
      const total = rects.reduce((s, r) => s + r.width, 0) || 1;
      let used = 0;
      rects.forEach((r, i) => {
        const take = i === rects.length - 1 ? word.length - used : Math.max(1, Math.round(r.width / total * word.length));
        if (take <= 0) return;
        raw.push({ text: word.slice(used, used + take), r });
        used += take;
      });
    }
  }
  if (!raw.length) return null;
  const lines = [];
  const pieces = [];
  let seq = "";
  for (const { text, r } of raw) {
    const top = r.top - box.top;
    const bottom = r.bottom - box.top;
    const mid = (top + bottom) / 2;
    let li = lines.findIndex((l) => mid > l.top && mid < l.bottom);
    if (li < 0) {
      lines.push({ top, bottom });
      li = lines.length - 1;
    } else {
      const l = lines[li];
      l.top = Math.min(l.top, top);
      l.bottom = Math.max(l.bottom, bottom);
    }
    if (seq) seq += " ";
    const a = seq.length;
    seq += text;
    pieces.push({ a, b: seq.length, line: li, x0: r.left - box.left, x1: r.right - box.left });
  }
  const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
  return { seq, pieces, lines, bands: bandsFor(lines), w: box.width, h: box.height, pad: Math.ceil(fontSize * 0.4) };
}

// src/tools.ts
function* frame(c) {
  c.shape("cross");
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x, y: r.y };
  }, { width: 14 });
  yield* c.click();
  c.hold(true);
  c.reveal.begin("inset(0 100% 100% 0)");
  const band = c.mark({
    kind: "drag",
    rect: () => {
      const r = c.rect();
      return { x: r.x, y: r.y, w: c.agent.x - r.x, h: c.agent.y - r.y };
    }
  });
  const start = c.rect();
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x + r.w, y: r.y + r.h };
  }, {
    drag: true,
    width: Math.max(24, Math.min(start.w, start.h) / 2),
    onStep: () => {
      const r = c.rect();
      c.reveal.sweep(r.w ? (c.agent.x - r.x) / r.w : 1, r.h ? (c.agent.y - r.y) / r.h : 1);
    }
  });
  c.hold(false);
  c.reveal.end();
  band.done();
  const label = c.label();
  if (label) c.mark({ kind: "select", rect: () => c.rect(), label, ttl: 0.8 });
  c.shape("arrow");
  yield* c.wait(0.18);
}
function* rule(c) {
  const r0 = c.rect();
  const horizontal = r0.w >= r0.h;
  const from = () => {
    const r = c.rect();
    return horizontal ? { x: r.x, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y };
  };
  const to = () => {
    const r = c.rect();
    return horizontal ? { x: r.x + r.w, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y + r.h };
  };
  c.shape("cross");
  yield* c.move(from, { width: 12 });
  yield* c.click();
  c.hold(true);
  c.reveal.begin(horizontal ? "inset(0 100% 0 0)" : "inset(0 0 100% 0)");
  const line = c.mark({ kind: "line", a: from, b: () => ({ x: c.agent.x, y: c.agent.y }) });
  yield* c.move(to, {
    drag: true,
    width: 30,
    onStep: () => {
      const r = c.rect();
      if (horizontal) c.reveal.sweep(r.w ? (c.agent.x - r.x) / r.w : 1, 1);
      else c.reveal.sweep(1, r.h ? (c.agent.y - r.y) / r.h : 1);
    }
  });
  c.hold(false);
  c.reveal.end();
  line.done();
  c.shape("arrow");
  yield* c.wait(0.1);
}
function* type(c) {
  let geo = c.text();
  if (!geo || !geo.pieces.length) {
    c.reveal.pop();
    return;
  }
  const first = () => {
    const g = c.text() ?? geo;
    const p = g.pieces[0];
    const l = g.lines[p.line];
    const r = c.rect();
    return { x: r.x + p.x0, y: r.y + (l.top + l.bottom) / 2 };
  };
  const line0 = geo.lines[geo.pieces[0].line];
  c.shape("beam");
  yield* c.move(first, { width: Math.max(10, line0.bottom - line0.top) });
  yield* c.click();
  let state = clipAt(geo, 0);
  c.reveal.begin(state.path);
  c.dim(true);
  const caret = c.mark({
    kind: "caret",
    a: () => {
      const r = c.rect();
      return { x: r.x + state.x, y: r.y + state.top };
    },
    b: () => {
      const r = c.rect();
      return { x: r.x + state.x, y: r.y + state.bottom };
    }
  });
  const total = geo.seq.length;
  const times = typingSchedule(geo.seq, typingBudget(total, c.agent.persona.pace), c.random);
  let typed = 0;
  let t = 0;
  while (typed < total) {
    t += yield;
    while (typed < total && times[typed] <= t) typed++;
    geo = c.text() ?? geo;
    state = clipAt(geo, typed);
    c.reveal.clip(state.path);
  }
  c.reveal.end();
  caret.done();
  c.dim(false);
  c.shape("arrow");
  const label = c.label();
  if (label) c.mark({ kind: "select", rect: () => c.rect(), label, ttl: 0.6 });
  yield* c.wait(0.08);
}
function* stamp(c) {
  const s0 = c.sourceRect();
  if (!s0) {
    yield* frame(c);
    return;
  }
  const off = { x: Math.min(s0.w * 0.35, 56), y: Math.min(s0.h * 0.35, 22) };
  c.shape("arrow");
  yield* c.move(() => {
    const r = c.sourceRect() ?? s0;
    return { x: r.x + off.x, y: r.y + off.y };
  }, { width: 40 });
  yield* c.click();
  const picked = c.mark({ kind: "select", rect: () => c.sourceRect() ?? s0 });
  c.shape("stamp");
  c.hold(true);
  const ghost = c.mark({
    kind: "ghost",
    rect: () => {
      const r = c.rect();
      return { x: c.agent.x - off.x, y: c.agent.y - off.y, w: r.w, h: r.h };
    }
  });
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x + off.x, y: r.y + off.y };
  }, { drag: true, width: 40 });
  c.hold(false);
  ghost.done();
  picked.done();
  c.reveal.settle();
  const label = c.label();
  if (label) c.mark({ kind: "select", rect: () => c.rect(), label, ttl: 0.7 });
  c.shape("arrow");
  yield* c.wait(0.16);
}
var TOOLS = /* @__PURE__ */ new Map([
  ["frame", frame],
  ["rule", rule],
  ["type", type],
  ["stamp", stamp]
]);

// src/styles.ts
var CSS2 = `
.swarmtroopers-pending{opacity:0!important;pointer-events:none!important}
.swarmtroopers-pop{transition:opacity .22s ease-out!important}
.swarmtroopers-settle{animation:swarmtroopers-settle .44s cubic-bezier(.3,1.5,.6,1) both}
@keyframes swarmtroopers-settle{from{opacity:.35;translate:0 -7px;scale:1.03}to{opacity:1;translate:none;scale:none}}
.swarmtroopers-controls{position:fixed;z-index:2147483001;box-sizing:border-box;display:flex;align-items:center;gap:3px;max-width:calc(100vw - 28px);padding:5px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:6px;font:500 12px/1.2 'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;isolation:isolate}
.swarmtroopers-controls[data-pos^=bottom]{bottom:max(14px,env(safe-area-inset-bottom,0px))}
.swarmtroopers-controls[data-pos^=top]{top:max(14px,env(safe-area-inset-top,0px))}
.swarmtroopers-controls[data-pos$=left]{left:max(14px,env(safe-area-inset-left,0px))}
.swarmtroopers-controls[data-pos$=right]{right:max(14px,env(safe-area-inset-right,0px))}
.swarmtroopers-controls .swarmtroopers-controls-title{display:flex;align-items:center;gap:7px;min-width:0;padding:0 12px 0 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.swarmtroopers-controls .swarmtroopers-controls-title img{display:block;flex:none;width:20px;height:20px;object-fit:contain}
.swarmtroopers-controls button{appearance:none;box-sizing:border-box;min-height:40px;min-width:44px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:0;border-radius:6px;margin:0;padding:0 13px;font:inherit;color:inherit;cursor:pointer;transition:background-color 160ms ease,color 160ms ease,transform 120ms ease,box-shadow 160ms ease;-webkit-tap-highlight-color:transparent}
.swarmtroopers-controls button[aria-pressed=true]{background:var(--st-fg,currentColor);color:var(--st-on,#fff)}
.swarmtroopers-controls button:active{transform:scale(.96)}
.swarmtroopers-controls button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media (hover:hover) and (pointer:fine){.swarmtroopers-controls button:not([aria-pressed=true]):hover{background:color-mix(in srgb,currentColor 8%,transparent)}}
@media (max-width:380px){.swarmtroopers-controls .swarmtroopers-controls-title{padding-right:6px;font-size:11px}.swarmtroopers-controls button{padding-inline:10px}}
@media print{.swarmtroopers-pending{opacity:1!important;pointer-events:auto!important}.swarmtroopers-overlay,.swarmtroopers-controls{display:none!important}}
@media (prefers-reduced-motion:reduce){.swarmtroopers-settle{animation:none}.swarmtroopers-pop,.swarmtroopers-controls button{transition:none!important}.swarmtroopers-controls button:active{transform:none}}
`;
var refs = 0;
var sheet = null;
var tag = null;
function injectStyles() {
  refs++;
  if (sheet || tag) return sheet ? document.adoptedStyleSheets.includes(sheet) : !!tag?.sheet;
  try {
    const s = new CSSStyleSheet();
    s.replaceSync(CSS2);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
    sheet = s;
  } catch {
    tag = document.createElement("style");
    tag.id = "swarmtroopers-styles";
    tag.textContent = CSS2;
    document.head.appendChild(tag);
  }
  return sheet ? document.adoptedStyleSheets.includes(sheet) : !!tag?.sheet;
}
function releaseStyles() {
  if (refs === 0 || --refs > 0) return;
  if (sheet) {
    const s = sheet;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== s);
    sheet = null;
  }
  tag?.remove();
  tag = null;
}

// src/options.ts
function validateOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("[swarmtroopers] options must be an object");
  const o = input;
  const number = (value, name, min, max = Infinity, integer = false) => {
    if (value === void 0) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) {
      throw new TypeError(`[swarmtroopers] ${name} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
    }
  };
  const choice = (name, values) => {
    if (o[name] !== void 0 && !values.includes(o[name])) throw new TypeError(`[swarmtroopers] invalid ${name}`);
  };
  choice("quality", ["auto", "full", "light", "off"]);
  choice("trigger", ["immediate", "scroll", "manual"]);
  choice("once", [false, "session"]);
  for (const name of ["auto", "inspect", "labels", "finale"]) {
    if (o[name] !== void 0 && typeof o[name] !== "boolean") throw new TypeError(`[swarmtroopers] ${name} must be a boolean`);
  }
  for (const name of ["selector", "storageKey", "locale", "leadName"]) {
    if (o[name] !== void 0 && (typeof o[name] !== "string" || !o[name].trim())) throw new TypeError(`[swarmtroopers] ${name} must be a non-empty string`);
  }
  number(o.speed, "speed", 0.01, 100);
  number(o.scale, "scale", 0.25, 4);
  number(o.patience, "patience", 0);
  number(o.maxTasks, "maxTasks", 0, 1e4, true);
  number(o.zIndex, "zIndex", 0, 2147483647, true);
  if (o.agents !== void 0) {
    if (!o.agents || typeof o.agents !== "object" || Array.isArray(o.agents)) throw new TypeError("[swarmtroopers] agents must be an object");
    number(o.agents.max, "agents.max", 1, 32, true);
  }
  if (o.names !== void 0 && typeof o.names !== "boolean" && (!Array.isArray(o.names) || !o.names.length || o.names.some((n) => typeof n !== "string" || !n.trim()))) throw new TypeError("[swarmtroopers] names must be a boolean or a non-empty list of names");
  if (o.palette !== void 0) {
    const p = o.palette;
    if (Array.isArray(p)) {
      if (!p.length || p.some((c) => typeof c !== "string" || !CSS.supports("color", c))) throw new TypeError("[swarmtroopers] palette must contain CSS colors");
    } else {
      if (!p || typeof p !== "object") throw new TypeError("[swarmtroopers] palette must be a list or specification");
      const spec = p;
      number(spec.count, "palette.count", 1, 64, true);
      number(spec.hue, "palette.hue", -36e4, 36e4);
      number(spec.lightness, "palette.lightness", 0, 1);
      number(spec.chroma, "palette.chroma", 0, 1);
    }
  }
  if (o.chat !== void 0 && typeof o.chat !== "boolean" && (!o.chat || typeof o.chat !== "object" || Array.isArray(o.chat))) throw new TypeError("[swarmtroopers] chat must be a boolean or an object");
  if (o.plugins !== void 0) {
    if (!Array.isArray(o.plugins) || o.plugins.some((p) => p !== "tokens" && (!p || typeof p !== "object" || typeof p.name !== "string" || ["setup", "invalidate", "label"].some((k) => p[k] !== void 0 && typeof p[k] !== "function")))) throw new TypeError("[swarmtroopers] invalid plugin");
  }
}
function resolveRoot(root) {
  if (typeof document === "undefined") throw new Error("[swarmtroopers] create() requires a browser document");
  const element = typeof root === "string" ? document.querySelector(root) : root ?? document.body;
  if (!(element instanceof Element)) throw new TypeError("[swarmtroopers] root must resolve to an existing Element; create after it mounts");
  return element;
}

// src/plugins/tokens.ts
function tokens(options = {}) {
  let index = null;
  const max = options.max ?? 2;
  return {
    name: "tokens",
    invalidate() {
      index = null;
    },
    label(el, tool) {
      if (!index) index = buildIndex(options);
      return describe(index, el, tool, max);
    }
  };
}
function kindOf(raw) {
  const n = raw.toLowerCase().replace(/[._\s]+/g, "-");
  if (/radius|rounded/.test(n)) return "radius";
  if (/(^|-)(colou?r|bg|background|fg|foreground|ink|surface|border|stroke|fill|brand|accent|gray|grey|neutral|white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-|$)/.test(n) || /text-(strong|primary|secondary|muted|faint|subtle|inverse|default)/.test(n)) {
    return "color";
  }
  if (/(font-size|fontsize|(^|-)(text|type|fs|heading|display)-)/.test(n)) return "font";
  if (/(^|-)(space|spacing|gap|gutter|padding|pad|margin|inset|stack|size)(-|$)/.test(n)) return "space";
  return null;
}
var ROLE_HINTS = {
  text: [/text|copy|content/, /fg|foreground|ink|on-/],
  background: [/bg|background|surface|canvas|fill/, /layer|card|panel/],
  border: [/border|line|stroke|divider|outline/, /edge|separator/]
};
function pickName(names, role) {
  if (!names || !names.length) return null;
  const score = (n) => {
    let s = 0;
    if (/(^|[-.])colou?r[-.]/.test(n)) s += 3;
    if (/(text|bg|background|surface|border|fg|brand|accent|strong|muted|primary|secondary)/.test(n)) s += 1;
    if (/[-.]\d+$/.test(n) && !/(space|spacing|text|radius|size)/.test(n)) s -= 2;
    if (/^-*(white|black|text|bg|accent|border|gray|grey)$/.test(n)) s -= 1;
    if (role) {
      const [first, second] = ROLE_HINTS[role];
      if (first.test(n)) s += 3;
      else if (second.test(n)) s += 2;
    }
    return s;
  };
  return names.slice().sort((a, b) => score(b) - score(a) || a.length - b.length)[0];
}
function flatten(src) {
  const flat = /* @__PURE__ */ new Map();
  const visit = (node, path, inherited) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const obj = node;
      const type2 = typeof obj.$type === "string" ? obj.$type : inherited;
      if ("$value" in obj) {
        flat.set(path.join("."), { value: obj.$value, type: type2 });
        return;
      }
      for (const [k, v] of Object.entries(obj)) if (!k.startsWith("$")) visit(v, [...path, k], type2);
      return;
    }
    if (typeof node === "string" || typeof node === "number") flat.set(path.join("."), { value: node, type: inherited });
  };
  visit(src, []);
  const resolve = (v, depth = 0) => {
    if (typeof v === "string" && /^\{[^}]+\}$/.test(v) && depth < 8) {
      const ref = flat.get(v.slice(1, -1));
      return ref ? resolve(ref.value, depth + 1) : v;
    }
    return v;
  };
  const out = [];
  for (const [name, { value, type: type2 }] of flat) {
    let v = resolve(value);
    if (v && typeof v === "object") {
      const o = v;
      if (typeof o.hex === "string") v = o.hex;
      else if (typeof o.value === "number" && typeof o.unit === "string") v = `${o.value}${o.unit}`;
    }
    if (typeof v === "number") v = `${v}px`;
    if (typeof v !== "string") continue;
    const kind = type2 === "color" ? "color" : kindOf(name) ?? (type2 === "dimension" ? "space" : null);
    if (kind) out.push([name, kind, v]);
  }
  return out;
}
function customProperties() {
  const names = /* @__PURE__ */ new Set();
  const rootSelector = /(^|,)\s*(:root|html)\s*(?=,|$)/;
  const walk = (rules) => {
    for (const rule2 of Array.from(rules)) {
      const styleRule = rule2;
      if (styleRule.style && styleRule.selectorText && rootSelector.test(styleRule.selectorText)) {
        for (const p of Array.from(styleRule.style)) if (p.startsWith("--")) names.add(p);
      }
      const inner = rule2.cssRules;
      if (inner && inner.length) walk(inner);
    }
  };
  const sheets = [...Array.from(document.styleSheets), ...document.adoptedStyleSheets ?? []];
  for (const sheet2 of sheets) {
    try {
      walk(sheet2.cssRules);
    } catch {
    }
  }
  for (const p of Array.from(document.documentElement.style)) if (p.startsWith("--")) names.add(p);
  return [...names];
}
var push = (map, key, name) => {
  const list = map.get(key);
  if (list) list.push(name);
  else map.set(key, [name]);
};
function buildIndex(o) {
  const idx = { font: /* @__PURE__ */ new Map(), space: /* @__PURE__ */ new Map(), radius: /* @__PURE__ */ new Map(), color: /* @__PURE__ */ new Map() };
  const entries = [];
  if (o.css !== false) {
    for (const name of customProperties()) {
      const k = kindOf(name);
      if (k) entries.push([name, k, `var(${name})`]);
    }
  }
  if (o.source) entries.push(...flatten(o.source));
  if (!entries.length) return idx;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;color:rgb(1, 2, 3);font-size:1.25px;width:333px";
  const probe2 = document.createElement("div");
  probe2.style.position = "absolute";
  host.appendChild(probe2);
  document.body.appendChild(host);
  try {
    for (const [name, kind, value] of entries) {
      if (kind === "color") {
        probe2.style.color = value;
        const v = getComputedStyle(probe2).color;
        probe2.style.color = "";
        if (v && v !== "rgb(1, 2, 3)" && !/,\s*0\)$|\/\s*0\)$/.test(v)) push(idx.color, v, name);
      } else if (kind === "font") {
        probe2.style.fontSize = value;
        const v = parseFloat(getComputedStyle(probe2).fontSize);
        probe2.style.fontSize = "";
        if (v && Math.abs(v - 1.25) > 0.01) push(idx.font, Math.round(v * 10) / 10, name);
      } else {
        probe2.style.width = value;
        const v = parseFloat(getComputedStyle(probe2).width);
        probe2.style.width = "";
        if (v > 0) push(idx[kind], Math.round(v * 10) / 10, name);
      }
    }
  } finally {
    host.remove();
  }
  return idx;
}
function nearest(map, value, tolerance) {
  if (!value) return null;
  let best;
  let gap = tolerance;
  for (const [k, names] of map) {
    const d = Math.abs(k - value);
    if (d <= gap) {
      gap = d;
      best = names;
    }
  }
  return pickName(best);
}
function describe(idx, el, tool, max) {
  const cs = getComputedStyle(el);
  const out = [];
  const add = (s) => {
    if (s && out.length < max && !out.includes(s)) out.push(s);
  };
  if (tool === "type") {
    add(nearest(idx.font, parseFloat(cs.fontSize), 0.6));
    add(pickName(idx.color.get(cs.color), "text"));
  } else if (tool === "rule") {
    add(pickName(idx.color.get(cs.backgroundColor), "border") ?? pickName(idx.color.get(cs.borderTopColor), "border"));
  } else {
    add(nearest(idx.radius, parseFloat(cs.borderTopLeftRadius), 0.5));
    add(pickName(idx.color.get(cs.backgroundColor), "background"));
    add(nearest(idx.space, parseFloat(cs.paddingTop), 0.5));
    add(pickName(idx.color.get(cs.borderTopColor), "border"));
  }
  return out.length ? out.join(" \xB7 ") : null;
}

// src/chat.ts
var NAMES = ["Ada", "L\xE9o", "Mia", "No\xE9", "Iris", "Tom", "Lou", "Max", "Zo\xE9", "Eli", "Nina", "Sam", "Jade", "Oscar", "Lina", "Th\xE9o"];
var EN = {
  lines: {
    plan: ["{s}, {n} on it", "{n} for {s}", "Taking {s}"],
    ready: ["{s} is ready", "{s} checked", "{s}, done"],
    reply: ["OK", "On it", "Got it"],
    rush: ["More hands, they scroll fast", "Speeding up"],
    done: ["Page complete"]
  },
  subjects: { header: "the header", footer: "the footer", part: "this part" },
  tasks: { type: "Writing {k}", frame: "Framing {k}", rule: "Drawing {k}", stamp: "Copying {k}", other: "Building {k}" },
  kinds: {
    title: "the title",
    text: "the text",
    label: "a label",
    item: "an item",
    button: "the button",
    link: "the link",
    image: "the image",
    card: "the card",
    line: "a divider",
    list: "the list",
    block: "a block"
  },
  lead: "Orchestrator"
};
var FR = {
  lines: {
    plan: ["{s}, {n} dessus", "{n} sur {s}", "Je prends {s}"],
    ready: ["{s}, c\u2019est bon", "Fini pour {s}", "{s}, valid\xE9"],
    reply: ["Ok", "Re\xE7u", "J\u2019y vais"],
    rush: ["Du renfort, \xE7a scrolle vite", "On acc\xE9l\xE8re"],
    done: ["Page termin\xE9e"]
  },
  subjects: { header: "l\u2019en-t\xEAte", footer: "le pied de page", part: "cette partie" },
  tasks: { type: "\xC9crit {k}", frame: "Cadre {k}", rule: "Trace {k}", stamp: "Duplique {k}", other: "Construit {k}" },
  kinds: {
    title: "le titre",
    text: "le texte",
    label: "un label",
    item: "un \xE9l\xE9ment",
    button: "le bouton",
    link: "le lien",
    image: "l\u2019image",
    card: "la carte",
    line: "un s\xE9parateur",
    list: "la liste",
    block: "un bloc"
  },
  lead: "Orchestrateur"
};
var LOCALES = { en: EN, fr: FR };
function chatPack(o = {}) {
  const lang = (o.locale || (typeof document !== "undefined" ? document.documentElement.lang : "") || "en").toLowerCase().slice(0, 2);
  const base = LOCALES[lang] ?? EN;
  return {
    lines: { ...base.lines, ...o.lines },
    subjects: { ...base.subjects, ...o.subjects },
    tasks: { ...base.tasks, ...o.tasks },
    kinds: { ...base.kinds, ...o.kinds },
    lead: base.lead
  };
}
function kindOf2(el, tool, fontSize = 16) {
  const tag2 = el.localName;
  if (tool === "rule" || tag2 === "hr") return "line";
  if (/^h[1-6]$/.test(tag2)) return "title";
  if (tag2 === "li" || tag2 === "dt" || tag2 === "dd" || tool === "stamp") return "item";
  if (tag2 === "button" || el.getAttribute("role") === "button") return "button";
  if (tag2 === "a") return "link";
  if (/^(img|svg|picture|video|canvas|figure|iframe)$/.test(tag2)) return "image";
  if (tag2 === "ul" || tag2 === "ol" || tag2 === "dl") return "list";
  if (tool === "type") return fontSize < 13.5 ? "label" : "text";
  if (tool === "frame") return "card";
  return "block";
}
function taskText(pack, tool, kind) {
  const verb = pack.tasks[tool] ?? pack.tasks.other;
  return verb.replace("{k}", pack.kinds[kind]);
}
function snippet(text, max = 22) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, "") + "\u2026";
}
var human = (id) => {
  const s = id.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
function sectionName(el, subjects) {
  if (!el) return subjects.part;
  const named = el.getAttribute("data-swarmtroopers-section") || el.getAttribute("aria-label");
  if (named) return snippet(named);
  if (el.id && !/^\d|[0-9a-f]{8}/.test(el.id)) return snippet(human(el.id));
  const heading = el.querySelector("h1, h2, h3");
  const title = heading ? heading.innerText || heading.textContent : "";
  if (title) return snippet(title);
  if (el.localName === "header") return subjects.header;
  if (el.localName === "footer") return subjects.footer;
  return subjects.part;
}
var fill = (template, s, n = 0) => template.replace("{s}", s).replace("{n}", String(n));

// src/swarmtroopers.ts
var PROFILES = {
  full: { max: 6, squad: 3, dprCap: 1.5, tempo: 0.9 },
  light: { max: 3, squad: 2, dprCap: 1, tempo: 1.15 }
};
var SECTION = "section, header, footer, article, aside, nav, [data-swarmtroopers-section]";
var ACTIVE_ROOTS = /* @__PURE__ */ new Map();
var FEATHER = 26;
var MASK_PROPS = ["mask-image", "-webkit-mask-image", "mask-repeat", "-webkit-mask-repeat", "mask-composite", "-webkit-mask-composite"];
var SOFT_MASK = typeof CSS !== "undefined" && typeof CSS.supports === "function" && (CSS.supports("mask-composite", "intersect") || CSS.supports("-webkit-mask-composite", "source-in"));
var SwarmTroopers = class {
  constructor(options = {}) {
    /** Speed multiplier applied to every gesture, recomputed each frame from the backlog. */
    this.tempo = 1;
    this.stylesOwned = false;
    this.unsupported = false;
    this.pluginCleanups = [];
    this.annotationOwners = /* @__PURE__ */ new WeakMap();
    this.taskSeq = 0;
    this.sectionSeq = 0;
    this.skipBuild = false;
    this.tasks = [];
    this.sections = [];
    this.sectionByKey = /* @__PURE__ */ new Map();
    this.byEl = /* @__PURE__ */ new WeakMap();
    /** Built elements retired while hidden (an inactive tab panel): shown again, they come back finished, not rebuilt. */
    this.built = /* @__PURE__ */ new WeakSet();
    this.agents = [];
    this.lead = null;
    /** Elements wearing our soft-edge mask, to take it off when their sweep ends or is cut short. */
    this.masked = /* @__PURE__ */ new WeakSet();
    /** Freshly built elements the orchestrator has not looked over yet, newest last. */
    this.review = [];
    this.anns = [];
    this.overlay = null;
    this.io = null;
    this.ro = null;
    this.events = new Emitter();
    this.r = rng();
    this.bg = [255, 255, 255];
    this.halo = "rgb(255, 255, 255)";
    this.ink = "rgb(20, 20, 20)";
    this.palette = ["#7f7f7f"];
    this.raf = 0;
    this.running = false;
    this.last = 0;
    this.clock = 0;
    this.started = false;
    this.paused = false;
    this.destroyed = false;
    this.finished = false;
    this.seq = 0;
    this.spawned = 0;
    this.doneCount = 0;
    this.t0 = 0;
    this.layout = 0;
    this.geos = /* @__PURE__ */ new WeakMap();
    this.rects = /* @__PURE__ */ new Map();
    this.sx = 0;
    this.sy = 0;
    this.pointer = null;
    /** Hover candidate, since when, and the element handed to the orchestrator. */
    this.insp = { el: null, since: 0, want: null };
    this.owned = [];
    this.unlisten = [];
    this.invalidateSoon = debounce(() => this.invalidate(), 120);
    this.look = { halo: "#fff", ink: "#111", sans: "system-ui, sans-serif", scale: 1.2 };
    this.chat = null;
    this.subjects = chatPack().subjects;
    this.leadName = "Orchestrator";
    this.words = chatPack();
    /** Last worker seen at work, who shares the final high five with the orchestrator. */
    this.lastWorker = null;
    /** The closing high five, drawn over the page once everything is built. */
    this.fin = null;
    this.queue = [];
    this.tick = (now) => {
      this.raf = 0;
      if (this.destroyed) {
        this.running = false;
        return;
      }
      try {
        const dt = clamp((now - this.last) / 1e3, 0, 0.05);
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
    validateOptions(options);
    this.root = resolveRoot(options.root);
    if ([...ACTIVE_ROOTS.keys()].some((root) => root === this.root || root.contains(this.root) || this.root.contains(root))) throw new Error("[swarmtroopers] this region already has an active instance");
    this.root.querySelector(options.selector ?? "[data-swarmtroopers]");
    this.unsupported = this.root.ownerDocument !== document || this.root.getRootNode() !== document;
    this.s = {
      selector: options.selector ?? "[data-swarmtroopers]",
      auto: options.auto ?? false,
      trigger: options.trigger ?? "immediate",
      quality: options.quality ?? "auto",
      max: options.agents?.max,
      speed: options.speed ?? 1,
      palette: options.palette,
      inspect: options.inspect ?? false,
      labels: options.labels ?? false,
      once: options.once ?? false,
      maxTasks: options.maxTasks ?? 400,
      zIndex: options.zIndex ?? 2147483e3,
      storageKey: options.storageKey ?? "swarmtroopers",
      names: options.names ?? true,
      finale: options.finale ?? true,
      locale: options.locale,
      leadName: options.leadName,
      scale: options.scale,
      patience: options.patience
    };
    this.plugins = (options.plugins ?? []).map((p) => p === "tokens" ? tokens() : p);
    this.q = this.unsupported ? "off" : this.resolveQuality();
    ACTIVE_ROOTS.set(this.root, this);
    try {
      this.stylesOwned = true;
      if (!injectStyles()) {
        this.unsupported = true;
        this.q = "off";
        console.warn("[swarmtroopers] styles unavailable; content remains visible");
      }
      this.paint(options.chat ?? false);
      for (const p of this.plugins) {
        const cleanup = p.setup?.(this);
        if (typeof cleanup === "function") this.pluginCleanups.push(cleanup);
      }
      if (this.root.getRootNode() !== document) console.warn("[swarmtroopers] this root is outside the supported document; its content remains visible");
      this.init();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }
  /** Current rendering budget. */
  get quality() {
    return this.q;
  }
  get stats() {
    return { tasks: this.tasks.length, done: this.doneCount, agents: this.spawned, active: this.agents.length };
  }
  /** Colours read from the page, handy to style UI placed around the troopers. */
  get theme() {
    return { background: this.halo, text: this.ink, rgb: this.bg, palette: this.palette };
  }
  on(type2, fn) {
    return this.events.on(type2, fn);
  }
  off(type2, fn) {
    this.events.off(type2, fn);
  }
  /** Starts the build. Called for you unless trigger is "manual". */
  start() {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.t0 = performance.now();
    this.events.emit("start", { tasks: this.tasks.length });
    this.wake();
  }
  pause() {
    this.paused = true;
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.wake();
  }
  /** Shows everything at once and sends the agents away. */
  finish() {
    if (this.destroyed) return;
    for (const a of this.agents) this.cancelJob(a);
    this.agents.length = 0;
    this.lead = null;
    this.fin = null;
    this.anns.length = 0;
    this.queue.length = 0;
    for (const t of this.tasks) if (t.state !== "done") this.complete(t);
    for (const sec of this.sections) sec.zone = null;
    this.started = true;
    this.wrapUp(false);
    this.wake();
  }
  /** Picks up elements added to the page since the troopers started (client-side navigation, lazy content). */
  refresh() {
    if (this.destroyed) return;
    const build = this.q !== "off" && !this.skipBuild;
    this.prune();
    this.sweepStale();
    this.collect(build);
    if (build && this.tasks.some((t) => t.state === "pending")) {
      this.finished = false;
      this.fin = null;
    }
    this.invalidate();
  }
  setQuality(q) {
    if (this.destroyed) return;
    if (!["full", "light", "off"].includes(q)) throw new TypeError("[swarmtroopers] invalid quality");
    storage.set("local", this.s.storageKey + ":quality", q);
    this.applyQuality(q);
  }
  applyQuality(q) {
    if (this.unsupported) q = "off";
    if (q === this.q || this.destroyed) return;
    this.q = q;
    if (q !== "off") {
      try {
        this.mountOverlay();
      } catch (error) {
        this.unsupported = true;
        this.q = "off";
        console.warn("[swarmtroopers] renderer unavailable; content remains visible", error);
        return;
      }
    }
    try {
      if (q === "off") {
        this.finish();
        this.overlay?.destroy();
        this.overlay = null;
      } else this.overlay?.setCap(PROFILES[q].dprCap);
      this.events.emit("quality", { quality: q });
      this.wake();
    } catch (error) {
      this.fail(error);
    }
  }
  /** Ties an element (a control panel…) to the troopers: it is removed by destroy(). */
  own(el) {
    this.owned.push(el);
  }
  /** Removes everything the troopers added and restores the page as it was. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
    this.invalidateSoon.cancel();
    for (const a of this.agents) this.cancelJob(a);
    for (const t of this.tasks) this.safe(() => {
      this.restoreClasses(t);
      if (t.state !== "done") this.restoreClip(t);
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
    document.documentElement.classList.remove("swarmtroopers-preload");
  }
  safe(fn) {
    try {
      fn();
    } catch (error) {
      console.warn("[swarmtroopers] cleanup or extension failed", error);
    }
  }
  fail(error) {
    console.warn("[swarmtroopers] animation stopped; original content restored", error);
    this.destroy();
  }
  restoreClip(t) {
    if (t.prevClip) t.el.style.setProperty("clip-path", t.prevClip, t.prevClipPriority);
    else t.el.style.removeProperty("clip-path");
    if (this.masked.delete(t.el)) for (const p of MASK_PROPS) t.el.style.removeProperty(p);
  }
  /**
   * Reveals the top-left part of an element. A gradient mask gives it a soft edge; an element with a mask of
   * its own, or a browser without mask compositing, gets the hard clip-path instead.
   */
  sweep(t, x, y) {
    const el = t.el;
    const px = clamp(x, 0, 1);
    const py = clamp(y, 0, 1);
    if (!this.masked.has(el)) {
      const own = el.style.getPropertyValue("mask-image") || el.style.getPropertyValue("-webkit-mask-image") || getComputedStyle(el).getPropertyValue("mask-image");
      if (!SOFT_MASK || own && own !== "none") {
        el.style.clipPath = `inset(0 ${(100 - px * 100).toFixed(2)}% ${(100 - py * 100).toFixed(2)}% 0)`;
        return;
      }
      this.masked.add(el);
      el.style.setProperty("mask-repeat", "no-repeat");
      el.style.setProperty("-webkit-mask-repeat", "no-repeat");
      el.style.setProperty("mask-composite", "intersect");
      el.style.setProperty("-webkit-mask-composite", "source-in");
    }
    const edge = (p) => `#000 calc(${(p * 100).toFixed(2)}% - ${(FEATHER * (1 - p)).toFixed(1)}px),transparent ${(p * 100).toFixed(2)}%`;
    const mask = `linear-gradient(to right,${edge(px)}),linear-gradient(to bottom,${edge(py)})`;
    el.style.setProperty("mask-image", mask);
    el.style.setProperty("-webkit-mask-image", mask);
    if (t.prevClip) el.style.setProperty("clip-path", t.prevClip, t.prevClipPriority);
    else el.style.removeProperty("clip-path");
  }
  restoreClasses(t) {
    t.el.classList.remove("swarmtroopers-pending");
    t.el.classList.toggle("swarmtroopers-pop", t.prevPop);
  }
  /** `swarmtroopers-pending` is ours alone: found on an element we do not track (a DOM snapshot taken mid-build), it would hide it for good. */
  sweepStale() {
    for (const el of this.root.querySelectorAll(".swarmtroopers-pending")) if (!this.byEl.has(el)) el.classList.remove("swarmtroopers-pending");
  }
  cancelJob(a) {
    const job = a.job;
    a.job = null;
    if (job) this.safe(() => {
      job.return(void 0);
    });
    for (const n of this.anns) if (this.annotationOwners.get(n) === a) n.done();
    a.hold = a.dim = a.rest = false;
    a.shape = "arrow";
    a.doing = null;
  }
  revealChain(t) {
    if (t.state === "done") return;
    for (const dependency of t.deps) this.revealChain(dependency);
    for (const agent of this.agents) if (agent.task === t) {
      this.cancelJob(agent);
      agent.task = null;
    }
    this.complete(t);
  }
  prune() {
    const removed = new Set(this.tasks.filter((t) => !t.el.isConnected || !this.root.contains(t.el) || !t.el.getClientRects().length));
    if (!removed.size) return;
    for (const a of this.agents) if (a.task && removed.has(a.task)) {
      this.cancelJob(a);
      a.task = null;
    }
    for (const t of removed) {
      if (t.state === "done" && this.root.contains(t.el)) this.built.add(t.el);
      this.restoreClasses(t);
      if (t.state !== "done") this.restoreClip(t);
      this.io?.unobserve(t.el);
      this.byEl.delete(t.el);
    }
    this.tasks = this.tasks.filter((t) => !removed.has(t));
    for (const t of this.tasks) {
      t.deps = t.deps.filter((d) => !removed.has(d));
      if (t.parent && removed.has(t.parent)) t.parent = null;
      if (t.source && removed.has(t.source)) t.source = null;
    }
    for (const sec of this.sections) sec.tasks = sec.tasks.filter((t) => !removed.has(t));
    this.sections = this.sections.filter((sec) => {
      if (sec.tasks.length) return true;
      if (sec.zone) {
        sec.zone.done();
        this.anns = this.anns.filter((annotation) => annotation !== sec.zone);
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
    this.doneCount = this.tasks.filter((t) => t.state === "done").length;
    this.rects.clear();
  }
  // ─── setup ────────────────────────────────────────────────────────────────
  resolveQuality() {
    const saved = storage.get("local", this.s.storageKey + ":quality");
    if (saved === "full" || saved === "light" || saved === "off") return saved;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "off";
    if (this.s.quality !== "auto") return this.s.quality;
    const nav = navigator;
    if (nav.connection?.saveData) return "light";
    if ((nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4) return "light";
    return "full";
  }
  paint(chat) {
    this.bg = pageBackground();
    const dark = relativeLuminance(this.bg) < 0.35;
    this.halo = `rgb(${this.bg.join(", ")})`;
    this.ink = dark ? "rgb(236, 238, 242)" : "rgb(13, 14, 17)";
    const p = this.s.palette ?? [dark ? "#ECEEF2" : "#0D0E11", "#7DB4FF", "#B98CFF", "#5FE3D0", "#FF7EB6"];
    this.palette = Array.isArray(p) && p.length ? p : buildPalette({ lightness: dark ? 0.76 : 0.6, ...Array.isArray(p) ? {} : p });
    const pack = chatPack({ locale: this.s.locale, ...typeof chat === "object" ? chat : {} });
    this.subjects = pack.subjects;
    this.leadName = this.s.leadName ?? pack.lead;
    this.words = { tasks: pack.tasks, kinds: pack.kinds };
    if (chat === true || typeof chat === "object" && chat.bubbles !== false) this.chat = { lines: pack.lines, subjects: pack.subjects };
    const sans = getComputedStyle(this.root).fontFamily || "system-ui, sans-serif";
    this.look = { halo: this.halo, ink: this.ink, sans, scale: this.s.scale ?? (this.narrow() ? 1.05 : 1.2) };
  }
  narrow() {
    return window.innerWidth < 600;
  }
  init() {
    this.skipBuild = this.s.once === "session" && storage.get("session", this.s.storageKey + ":seen") === "1";
    const build = this.q !== "off" && !this.skipBuild;
    if (this.q !== "off") {
      try {
        this.mountOverlay();
      } catch (error) {
        this.unsupported = true;
        this.q = "off";
        console.warn("[swarmtroopers] renderer unavailable; content remains visible", error);
      }
    }
    const canBuild = build && this.q !== "off";
    this.sweepStale();
    if (canBuild || this.s.inspect) this.collect(canBuild);
    document.documentElement.classList.remove("swarmtroopers-preload");
    this.listen(this.root, "focusin", (event) => {
      for (let el = event.target instanceof Element ? event.target : null; el && el !== this.root.parentElement; el = el.parentElement) {
        const task = this.byEl.get(el);
        if (task) this.revealChain(task);
      }
      this.wake();
    });
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion) this.listen(motion, "change", () => {
      const saved = storage.get("local", this.s.storageKey + ":quality");
      if (!["full", "light", "off"].includes(saved ?? "")) this.applyQuality(this.resolveQuality());
    });
    this.listen(window, "beforeprint", () => this.finish());
    const print = window.matchMedia?.("print");
    if (print) this.listen(print, "change", () => {
      if (print.matches) this.finish();
    });
    this.listen(window, "resize", () => this.invalidateSoon(), { passive: true });
    this.listen(window, "scroll", () => this.onScroll(), { passive: true });
    for (const type2 of ["wheel", "touchstart", "pointerdown", "keydown"]) this.listen(window, type2, () => this.dismiss(), { passive: true });
    this.listen(document, "visibilitychange", () => {
      if (!document.hidden) this.wake();
    });
    if (this.s.inspect) {
      this.listen(document, "pointermove", (e) => this.onPointer(e), { passive: true });
      this.listen(document.documentElement, "pointerleave", () => {
        this.pointer = null;
        this.wake();
      });
    }
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.invalidateSoon());
      this.ro.observe(this.root);
    }
    document.fonts?.ready.then(() => this.invalidate()).catch(() => void 0);
    if (!canBuild) {
      this.started = true;
      this.finished = true;
      return;
    }
    if (this.s.trigger === "immediate") this.start();
    else if (this.s.trigger === "scroll") {
      const kinds = ["scroll", "wheel", "touchmove", "keydown", "pointerdown"];
      const go = () => {
        stop();
        this.start();
      };
      const stop = () => kinds.forEach((k) => window.removeEventListener(k, go));
      kinds.forEach((k) => window.addEventListener(k, go, { passive: true }));
      this.unlisten.push(stop);
    }
  }
  /** Scans the root and creates the tasks it does not know yet, grouped by section. */
  collect(build) {
    const drafts = scan(this.root, { auto: this.s.auto, selector: this.s.selector, maxTasks: this.s.maxTasks, known: (el) => this.byEl.has(el) || this.built.has(el) });
    const created = /* @__PURE__ */ new Map();
    for (const d of drafts) {
      if (this.byEl.has(d.el)) continue;
      if (this.tasks.length >= this.s.maxTasks) break;
      const tool = d.tool === "instant" || TOOLS.has(d.tool) ? d.tool : "frame";
      const section = this.sectionFor(d.el);
      const id = this.taskSeq++;
      const rebuilt = this.built.delete(d.el);
      const t = {
        id,
        el: d.el,
        tool,
        // Never reused, unlike the list length once refresh() has pruned tasks.
        order: id,
        parent: null,
        source: null,
        deps: [],
        section,
        state: build && !rebuilt ? "pending" : "done",
        seen: false,
        inView: false,
        waitingSince: 0,
        prevClip: d.el.style.getPropertyValue("clip-path"),
        prevClipPriority: d.el.style.getPropertyPriority("clip-path"),
        prevPop: d.el.classList.contains("swarmtroopers-pop")
      };
      section.tasks.push(t);
      created.set(d, t);
      this.tasks.push(t);
      this.byEl.set(d.el, t);
    }
    for (const d of drafts) {
      const t = created.get(d);
      if (!t) continue;
      t.parent = d.parent ? created.get(d.parent) ?? this.byEl.get(d.parent.el) ?? null : null;
      t.source = d.source ? created.get(d.source) ?? this.byEl.get(d.source.el) ?? null : null;
      t.deps = [t.parent, t.source].filter((x) => !!x);
    }
    this.doneCount = this.tasks.filter((t) => t.state === "done").length;
    const fresh = Array.from(created.values()).filter((t) => t.state === "pending");
    for (const t of fresh) t.el.classList.add("swarmtroopers-pending");
    if (fresh.length) this.observe(fresh);
  }
  sectionFor(el) {
    let found = null;
    for (let n = el; n && n !== this.root; n = n.parentElement) if (n.matches(SECTION)) found = n;
    const key = found ?? "band:" + Math.floor((el.getBoundingClientRect().top + window.scrollY) / (window.innerHeight * 0.9));
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
        zone: null
      };
      this.sections.push(sec);
      this.sectionByKey.set(key, sec);
    }
    return sec;
  }
  observe(list) {
    if (typeof IntersectionObserver === "undefined") {
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
        { rootMargin: "0px 0px -6% 0px" }
      );
    }
    for (const t of list) this.io.observe(t.el);
  }
  mountOverlay() {
    if (this.overlay) return;
    this.overlay = new Overlay(this.s.zIndex, PROFILES[this.q === "light" ? "light" : "full"].dprCap);
  }
  listen(target, type2, fn, opts) {
    target.addEventListener(type2, fn, opts);
    this.unlisten.push(() => target.removeEventListener(type2, fn, opts));
  }
  // ─── loop ─────────────────────────────────────────────────────────────────
  wake() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }
  /** The loop sleeps as soon as nothing moves. */
  busy() {
    if (this.fin) return true;
    if (this.agents.some((a) => !a.rest || a.say) || this.queue.length) return true;
    if (this.anns.some((n) => n.closed || n.ttl !== Infinity)) return true;
    if (this.started && !this.finished && this.hasReady()) return true;
    return this.s.inspect && this.insp.el !== this.insp.want;
  }
  ready(t) {
    return t.state === "pending" && t.seen && t.deps.every((d) => d.state === "done");
  }
  hasReady() {
    for (const t of this.tasks) if (this.ready(t)) return true;
    return false;
  }
  patience() {
    return this.s.patience ?? (this.narrow() || this.q === "light" ? 1.4 : 2.4);
  }
  update(dt) {
    const prof = PROFILES[this.q === "light" ? "light" : "full"];
    const building = this.started && !this.finished && this.q !== "off";
    const work = [];
    if (building) {
      const patience = this.patience();
      const blocking = /* @__PURE__ */ new Set();
      for (const t of this.tasks) if (t.state === "pending" && t.inView) for (const d of t.deps) blocking.add(d);
      this.follow();
      for (const t of this.tasks) {
        if (t.state === "pending" && t.inView && !t.waitingSince) t.waitingSince = this.clock || 1e-6;
        if (t.state === "pending" && t.inView && t.waitingSince && !this.ready(t) && this.clock - t.waitingSince > patience) {
          this.popChain(t);
          continue;
        }
        if (!this.ready(t)) continue;
        if (t.tool === "instant") {
          this.pop(t);
          continue;
        }
        const r = this.rect(t.el);
        if (!t.inView && r.y + r.h < this.sy) {
          this.pop(t);
          continue;
        }
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
    this.tempo = this.s.speed * prof.tempo * (1 + Math.min(0.5, work.length / Math.max(1, workers.length) * 0.12));
    if (work.length) {
      work.sort(byPriority);
      for (const a of workers) {
        if (a.job || !a.squad) continue;
        let mine = work.filter((t2) => t2.section === a.squad);
        if (!mine.some((t2) => t2.inView)) {
          const sec = this.visibleSection(work, prof.squad + 1);
          if (sec && sec !== a.squad) {
            a.squad = sec;
            a.idle = 0;
            mine = work.filter((t2) => t2.section === sec);
          }
        }
        const t = pickTask(mine, a, 3, (task) => {
          const r = this.rect(task.el);
          return { x: r.x, y: r.y };
        });
        if (!t) continue;
        work.splice(work.indexOf(t), 1);
        this.assign(a, t);
      }
    }
    for (const a of this.agents.slice()) this.stepAgent(a, dt);
    if (this.s.inspect && this.q !== "off" && !this.fin) this.inspect();
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
  makeAgent(x, y, color) {
    const a = {
      id: this.seq++,
      color,
      lead: false,
      squad: null,
      name: "",
      say: null,
      x,
      y,
      shape: "arrow",
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
      flip: false
    };
    this.agents.push(a);
    this.spawned++;
    return a;
  }
  /** The orchestrator walks in from the right edge, near the top of the screen. */
  spawnLead() {
    const home = this.leadHome();
    const a = this.makeAgent(home.x, home.y, this.ink);
    a.alpha = 0;
    a.lead = true;
    a.name = this.s.names !== false ? this.leadName : "";
    a.job = this.leadLoop(a);
    return a;
  }
  /**
   * The troopers follow the reader. A task whose element left the screen is settled at once: shown if the reader
   * went past it, put back for later if the reader went back up. Its worker is then free for what is in view.
   */
  follow() {
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
        t.state = "pending";
        t.waitingSince = 0;
        this.restoreClip(t);
        t.el.classList.add("swarmtroopers-pending");
      }
    }
  }
  /** The visible section with the most work waiting and room in its squad. */
  visibleSection(work, cap) {
    const count = /* @__PURE__ */ new Map();
    for (const t of work) if (t.inView) count.set(t.section, (count.get(t.section) ?? 0) + 1);
    let best = null;
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
  nameFor() {
    if (!this.s.names) return "";
    const pool = Array.isArray(this.s.names) && this.s.names.length ? this.s.names : NAMES;
    const used = new Set(this.agents.map((x) => x.name));
    const free = pool.filter((n) => !used.has(n));
    const list = free.length ? free : pool;
    return list[Math.floor(this.r.next() * list.length)];
  }
  assign(a, t) {
    t.state = "active";
    a.task = t;
    a.idle = 0;
    if (a.name) {
      this.lastWorker = { name: a.name, color: a.color };
      const size = t.tool === "type" ? parseFloat(getComputedStyle(t.el).fontSize) || 16 : 16;
      a.doing = { text: taskText(this.words, t.tool, kindOf2(t.el, t.tool, size)), age: 0 };
      if (this.narrow()) {
        for (const o of this.agents) if (o !== a) o.doing = null;
      }
    }
    const tool = TOOLS.get(t.tool) ?? TOOLS.get("frame");
    try {
      if (!tool) throw new Error("[swarmtroopers] tool unavailable");
      const job = tool(this.context(a, t));
      if (!job || typeof job.next !== "function" || typeof job.return !== "function") throw new TypeError("[swarmtroopers] tool must return a generator");
      a.job = job;
    } catch (error) {
      console.warn("[swarmtroopers] tool failed; element restored", error);
      this.cancelJob(a);
      this.complete(t);
      a.task = null;
    }
  }
  stepAgent(a, dt) {
    a.press = a.hold ? 1 : Math.max(0, a.press - dt * 4);
    a.alpha += ((a.dim ? 0.18 : 1) - a.alpha) * Math.min(1, dt * 12);
    if (a.doing && (a.doing.age += dt) > 2.8) a.doing = null;
    if (!a.job) {
      if (a.lead) return;
      const drift = (t, k) => Math.sin(t * 1.7 + a.id * k) * 1.4 + Math.sin(t * 0.6 + a.id * 2 * k) * 2.2;
      a.x += drift(a.idle + dt, 1) - drift(a.idle, 1);
      a.y += drift(a.idle + dt, 3) - drift(a.idle, 3);
      a.idle += dt;
      const pending = !!a.squad && a.squad.tasks.some((t) => t.state === "pending" && t.tool !== "instant");
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
      console.warn("[swarmtroopers] a tool failed, its element is shown as is", err);
      this.cancelJob(a);
      done = true;
    }
    if (!done) return;
    a.job = null;
    a.hold = false;
    a.dim = false;
    a.rest = false;
    a.shape = "arrow";
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
  *regroup(a) {
    a.shape = "arrow";
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
  *depart(w, i, n, sec, from) {
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
      x: r.x + r.w * (i + 1) / (n + 1),
      y: clamp(r.y + Math.min(r.h / 2, 160), this.sy + 80, this.sy + vh - 80)
    };
    const dx = goal.x - w.x;
    const dy = goal.y - w.y;
    const d = Math.hypot(dx, dy) || 1;
    const turn = (i - (n - 1) / 2) * 0.45;
    const ux = dx / d * Math.cos(turn) - dy / d * Math.sin(turn);
    const uy = dx / d * Math.sin(turn) + dy / d * Math.cos(turn);
    const step = Math.min(d * 0.6, 170);
    yield* this.travel(w, { x: w.x + ux * step, y: w.y + uy * step }, { width: 50 });
  }
  *leave(a) {
    a.shape = "arrow";
    const right = a.x - this.sx > window.innerWidth / 2;
    const exit = { x: this.sx + (right ? window.innerWidth + 40 : -40), y: a.y };
    yield* this.travel(a, exit, { width: 160 });
  }
  /** Follows a planned path. If the target moves meanwhile (sticky, marquee…), the path bends towards it. */
  *travel(a, to, o = {}) {
    const target = typeof to === "function" ? to : () => to;
    const goal = target();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (a.y < this.sy - 80) a.y = this.sy - 40;
    else if (a.y > this.sy + vh + 80) a.y = this.sy + vh + 40;
    if (a.x < this.sx - 80) a.x = this.sx - 40;
    else if (a.x > this.sx + vw + 80) a.x = this.sx + vw + 40;
    const segs = planMove({ x: a.x, y: a.y }, goal, a.persona, this.r, o);
    const total = segs.reduce((s, g2) => s + g2.dur + g2.pause, 0) || 1;
    let elapsed = 0;
    for (const seg of segs) {
      let t = -seg.pause;
      while (t < seg.dur) {
        const d = yield;
        t += d;
        elapsed += d;
        if (t <= 0) continue;
        const p = pointOn(seg, Math.min(t, seg.dur));
        const g2 = target();
        const k = Math.min(1, elapsed / total);
        a.x = p.x + (g2.x - goal.x) * k;
        a.y = p.y + (g2.y - goal.y) * k;
        o.onStep?.();
      }
    }
    const g = target();
    a.x = g.x;
    a.y = g.y;
    o.onStep?.();
  }
  *wait(seconds) {
    let e = 0;
    while (e < seconds) e += yield;
  }
  // ─── orchestrator ─────────────────────────────────────────────────────────
  /** Survey, dispatch, check, and inspect once the page is built. */
  *leadLoop(a) {
    for (; ; ) {
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
  building() {
    return this.started && !this.finished && this.q !== "off";
  }
  /** Top right of the screen, out of the way of the content. */
  leadHome() {
    const vw = window.innerWidth;
    return { x: this.sx + vw - Math.min(150, vw * 0.22), y: this.sy + window.innerHeight * 0.2 };
  }
  squadOf(sec) {
    return this.agents.filter((a) => a.squad === sec && !a.leaving);
  }
  /** A section with work and nobody on it, the visible ones first. Or a squad drowning in work. */
  nextSection() {
    const prof = PROFILES[this.q === "light" ? "light" : "full"];
    const max = Math.min(this.s.max ?? prof.max, this.q === "light" ? prof.max : 32);
    const busy = this.agents.filter((a) => !a.lead && !a.leaving).length;
    if (busy >= max) return null;
    let best = null;
    let bestScore = Infinity;
    let rush = null;
    for (const sec of this.sections) {
      let readyCount = 0;
      let visible = false;
      for (const t of sec.tasks) {
        if (t.tool === "instant" || !this.ready(t)) continue;
        readyCount++;
        if (t.inView) visible = true;
      }
      if (!readyCount) continue;
      const squad = this.squadOf(sec).length;
      if (!squad) {
        const score = (visible ? 0 : 1e3) + sec.order;
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
  sectionRect(sec) {
    if (sec.el) return this.rect(sec.el);
    if (!sec.tasks.length) return { x: this.sx, y: this.sy, w: 0, h: 0 };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const t of sec.tasks) {
      const r = this.rect(t.el);
      if (!r.w && !r.h) continue;
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    return x1 < x0 ? { x: this.sx, y: this.sy, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  *dispatch(a, sec, reinforce) {
    const prof = PROFILES[this.q === "light" ? "light" : "full"];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const corner = () => {
      const r = this.sectionRect(sec);
      return { x: clamp(r.x, this.sx + 24, this.sx + vw - 60), y: clamp(r.y, this.sy + 40, this.sy + vh - 120) };
    };
    yield* this.travel(a, corner, { width: 80 });
    const ready = sec.tasks.filter((t) => this.ready(t) && t.tool !== "instant").length;
    const left = sec.tasks.filter((t) => t.state === "pending" && t.tool !== "instant").length;
    const room = Math.min(this.s.max ?? prof.max, this.q === "light" ? prof.max : 32) - this.agents.filter((x) => !x.lead && !x.leaving).length;
    const n = clamp(Math.ceil(left / 5), 1, Math.max(1, Math.min(room, reinforce ? 2 : prof.squad)));
    if (ready && room > 0) {
      this.speak(a, this.line(reinforce ? "rush" : "plan", sec.name, n));
      const sent = [];
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
      sec.planned = true;
      let progress = 0;
      const zone = this.mark(a, {
        kind: "zone",
        color: sec.color,
        rect: () => {
          const r = this.sectionRect(sec);
          return { x: r.x, y: r.y, w: r.w * progress, h: r.h };
        }
      });
      sec.zone = zone;
      const start = corner();
      const span = Math.max(1, Math.min(this.sectionRect(sec).w, this.sx + vw - 40 - start.x));
      yield* this.travel(a, () => ({ x: corner().x + span, y: corner().y }), {
        drag: true,
        width: 120,
        onStep: () => {
          progress = clamp((a.x - start.x) / span, 0, 1);
        }
      });
      progress = 1;
      if (sec.tasks.every((t) => t.state === "done")) {
        zone.done();
        sec.zone = null;
      }
    }
    const said = a.say;
    let e = 0;
    while (said && a.say === said && said.age < said.ttl * 0.7 && e < 1.4) e += yield;
    yield* this.wait(0.3);
  }
  /** The most recent piece of work still on screen, if any. Older ones are let go. */
  nextReview() {
    while (this.review.length) {
      const t = this.review.pop();
      if (t.inView && t.el.isConnected) {
        this.review.length = 0;
        return t;
      }
    }
    return null;
  }
  /** Between two dispatches the orchestrator looks over what a worker just finished: over, a tap, a beat. */
  *check(a, t) {
    const urgent = () => this.building() && !!this.nextSection();
    const at = () => {
      const r = this.rect(t.el);
      return { x: r.x + r.w - Math.min(24, r.w / 4), y: r.y + Math.min(16, r.h / 2) };
    };
    const go = this.travel(a, at, { width: 40 });
    for (let step = go.next(); !step.done; ) {
      if (urgent()) {
        go.return(void 0);
        return;
      }
      const dt = yield;
      step = go.next(dt);
    }
    a.press = 1;
    this.mark(a, { kind: "select", rect: () => this.rect(t.el), ttl: 0.55 });
    for (let e = 0, beat = this.r.range(0.45, 0.8); e < beat && !urgent(); ) e += yield;
  }
  *inspectWith(a, el) {
    const t = this.byEl.get(el);
    yield* this.travel(a, () => {
      const r = this.rect(el);
      return { x: r.x + Math.min(28, r.w / 3), y: r.y + Math.min(16, r.h / 3) };
    }, { width: 40 });
    const mark = this.mark(a, { kind: "select", rect: () => this.rect(el), label: this.labelFor(el, t ? t.tool : "frame", true) });
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
  context(a, t) {
    const el = t.el;
    const self = this;
    return {
      el,
      task: t,
      agent: a,
      random: this.r,
      rect: () => this.rect(el),
      sourceRect: () => t.source ? this.rect(t.source.el) : null,
      move: (to, o) => this.travel(a, to, o),
      wait: (seconds) => self.wait(seconds),
      click: function* () {
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
          el.classList.remove("swarmtroopers-pending");
        },
        clip: (value) => {
          el.style.clipPath = value;
        },
        sweep: (x, y) => this.sweep(t, x, y),
        end: () => {
          this.restoreClip(t);
        },
        pop: () => this.pop(t),
        settle: () => this.pop(t, "swarmtroopers-settle", 460)
      }
    };
  }
  complete(t) {
    if (t.state === "done") return;
    t.state = "done";
    this.doneCount++;
    t.el.classList.remove("swarmtroopers-pending");
    this.restoreClip(t);
    this.io?.unobserve(t.el);
    if (this.building() && t.inView && t.tool !== "instant" && this.agents.some((x) => x.task === t) && this.review.push(t) > 6) this.review.shift();
    this.events.emit("task", { el: t.el, tool: t.tool });
    const sec = t.section;
    if (!sec.announced && sec.tasks.every((x) => x.state === "done")) {
      sec.announced = true;
      sec.zone?.done();
      sec.zone = null;
      if (sec.planned && this.lead && !this.finished && t.inView) this.speak(this.lead, this.line("ready", sec.name));
    }
  }
  popChain(t) {
    if (t.state !== "pending") return;
    for (const d of t.deps) this.popChain(d);
    this.pop(t);
  }
  pop(t, cls = "swarmtroopers-pop", ms = 260) {
    if (t.state === "done") return;
    const el = t.el;
    el.classList.add(cls);
    this.complete(t);
    window.setTimeout(() => cls === "swarmtroopers-pop" ? el.classList.toggle(cls, t.prevPop) : el.classList.remove(cls), ms);
  }
  wrapUp(finale = true) {
    if (this.finished) return;
    this.finished = true;
    if (this.s.once === "session") storage.set("session", this.s.storageKey + ":seen", "1");
    const duration = this.t0 ? (performance.now() - this.t0) / 1e3 : 0;
    if (finale && this.s.finale && this.q !== "off" && this.overlay && this.spawned > 0) {
      this.queue.length = 0;
      for (const a of this.agents) a.say = null;
      const right = this.lead ?? { name: this.s.names !== false ? this.leadName : "", color: this.ink };
      const left = this.lastWorker ?? { name: this.nameFor(), color: this.palette[0] };
      const at = this.lead ? { x: this.lead.x - this.sx, y: this.lead.y - this.sy } : { x: innerWidth / 2, y: innerHeight / 2 };
      this.fin = {
        age: 0,
        close: 0,
        at,
        left: { name: this.s.names !== false ? left.name : "", color: left.color },
        right: { name: right.name, color: right.color }
      };
    } else if (this.lead && this.q !== "off") {
      this.queue.length = 0;
      this.say(this.lead, this.line("done"), 2.4);
    }
    this.events.emit("done", { tasks: this.tasks.length, agents: this.spawned, duration });
  }
  /** Runs the closing clap while the troopers fade out. */
  finale(dt) {
    const f = this.fin;
    if (!f) return;
    f.age += dt;
    if (f.close) f.close += dt;
    if (f.age > 0.35 && this.agents.length) {
      for (const a of this.agents) this.cancelJob(a);
      this.agents.length = 0;
      this.lead = null;
    }
    if (f.close && f.close > FINALE_OUT || f.age > FINALE_END) this.fin = null;
  }
  /** Any deliberate input closes the finale at once. Momentum scrolling does not count. */
  dismiss() {
    if (this.fin && !this.fin.close && this.fin.age > 0.5) {
      this.fin.close = 1e-6;
      this.wake();
    }
  }
  onScroll() {
    if (this.started && !this.finished) {
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
  line(key, subject = "", n = 0) {
    const list = this.chat?.lines[key] ?? [];
    return list.length ? fill(list[Math.floor(this.r.next() * list.length)], subject, n) : "";
  }
  say(a, text, ttl) {
    if (!text) return;
    const words = text.split(/\s+/).length;
    a.say = { text, age: 0, ttl: ttl ?? Math.min(4.5, 1.8 + words * 0.32) };
  }
  talking() {
    let n = 0;
    for (const a of this.agents) if (a.say) n++;
    return n;
  }
  /**
   * The orchestrator speaks at once, its new line replacing the previous one, so what it says
   * always matches where it stands. Other lines wait their turn and are dropped if they come too late.
   */
  speak(a, text) {
    if (!text || !this.chat || this.q === "off") return;
    if (a.lead) {
      this.queue = this.queue.filter((m) => m.a !== a);
      if (this.narrow()) {
        for (const o of this.agents) if (o !== a) o.say = null;
      }
      this.say(a, text);
      return;
    }
    this.queue.push({ a, text, at: this.clock, until: this.clock + 2.5, overlap: false });
  }
  /** A short answer may overlap the line it answers. */
  reply(a) {
    this.queue.push({ a, text: this.line("reply"), at: this.clock + this.r.range(0.5, 0.8), until: this.clock + 2, overlap: true });
  }
  converse(dt) {
    for (const a of this.agents) if (a.say && (a.say.age += dt) > a.say.ttl) a.say = null;
    if (!this.chat || this.q === "off") {
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
  onPointer(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    this.pointer = e.target instanceof Element ? e.target : null;
    if (this.q !== "off") this.wake();
  }
  /** After a short hover on a finished element, it is handed to the orchestrator. */
  inspect() {
    let el = null;
    for (let n = this.pointer; n && n !== this.root.parentElement; n = n.parentElement) {
      const t = this.byEl.get(n);
      if (t && t.state === "done") {
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
  mark(a, init) {
    const n = {
      ...init,
      color: init.color ?? a?.color ?? this.palette[0],
      ttl: init.ttl ?? Infinity,
      age: 0,
      out: 0,
      closed: false,
      done: () => {
        n.closed = true;
      }
    };
    if (a) this.annotationOwners.set(n, a);
    this.anns.push(n);
    return n;
  }
  labelFor(el, tool, force = false) {
    if (!force && (!this.s.labels || this.narrow())) return "";
    for (const p of this.plugins) {
      try {
        const s = p.label?.(el, tool);
        if (s) return s;
      } catch (err) {
        console.warn(`[swarmtroopers] plugin "${p.name}" failed to label an element`, err);
      }
    }
    const r = this.rect(el);
    if (tool === "type") return `${el.localName} \xB7 ${Math.round(parseFloat(getComputedStyle(el).fontSize))}px`;
    if (tool === "rule") return `${Math.round(Math.max(r.w, r.h))}px`;
    return `${Math.round(r.w)} \xD7 ${Math.round(r.h)}`;
  }
  text(el) {
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
  rect(el) {
    let r = this.rects.get(el);
    if (!r) {
      const b = el.getBoundingClientRect();
      r = { x: b.left + this.sx, y: b.top + this.sy, w: b.width, h: b.height };
      this.rects.set(el, r);
    }
    return r;
  }
  invalidate() {
    if (this.destroyed) return;
    this.layout++;
    this.overlay?.resize();
    for (const p of this.plugins) this.safe(() => p.invalidate?.());
    this.wake();
  }
};

// assets/swarmtroopers-mark-sm.svg
var swarmtroopers_mark_sm_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><style>path,use{fill:%230D0E11}@media (prefers-color-scheme:dark){path,use{fill:%23ECEEF2}}</style><defs><path id="d" d="M0 0L0 20L5.5 14.5L14 14Z"/></defs><use href="%23d" transform="translate(10.3 4.5) scale(.9)"/><use href="%23d" transform="translate(10.3 25.5) scale(.9)"/><use href="%23d" transform="translate(25 19.2) scale(.9)"/></svg>%0A';

// src/controls.ts
function controls(swarmtroopers, options = {}) {
  const text = { title: "swarmtroopers", full: "Full", light: "Light", off: "Off", ...options.labels };
  const box = document.createElement("div");
  box.className = "swarmtroopers-controls";
  box.dataset.pos = options.position ?? "bottom-left";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", text.title);
  const { rgb, text: ink } = swarmtroopers.theme;
  box.style.color = ink;
  box.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  box.style.setProperty("--st-on", box.style.background);
  box.style.setProperty("--st-fg", ink);
  const title = document.createElement("span");
  title.className = "swarmtroopers-controls-title";
  const mark = document.createElement("img");
  mark.addEventListener("error", () => mark.remove(), { once: true });
  mark.src = swarmtroopers_mark_sm_default;
  mark.alt = "";
  mark.width = mark.height = 20;
  title.append(document.createTextNode(text.title), mark);
  box.appendChild(title);
  const buttons = ["full", "light", "off"].map((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text[q];
    b.addEventListener("click", () => swarmtroopers.setQuality(q));
    box.appendChild(b);
    return { q, b };
  });
  const sync = () => {
    for (const { q, b } of buttons) b.setAttribute("aria-pressed", String(swarmtroopers.quality === q));
  };
  sync();
  swarmtroopers.on("quality", sync);
  (options.container ?? document.body).appendChild(box);
  swarmtroopers.own(box);
  return box;
}

// src/index.ts
var version = true ? "0.5.1" : "dev";
function create(options) {
  return new SwarmTroopers(options);
}
function defineTool(name, tool) {
  TOOLS.set(name, tool);
}
//# sourceMappingURL=swarmtroopers.cjs.map
