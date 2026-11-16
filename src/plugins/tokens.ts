import type { SwarmTroopersElement, SwarmTroopersPlugin } from '../types.js';

type Kind = 'font' | 'color' | 'space' | 'radius';

export interface TokensOptions {
  /**
   * Extra tokens, flat (`{ "color.text.strong": "#fff" }`) or in the DTCG format
   * (`{ color: { text: { strong: { $type: "color", $value: "#fff" } } } }`).
   */
  source?: Record<string, unknown>;
  /** Read the custom properties declared on :root and html. Defaults to true. */
  css?: boolean;
  /** Maximum number of tokens in one label. Defaults to 2. */
  max?: number;
}

interface Index {
  font: Map<number, string[]>;
  space: Map<number, string[]>;
  radius: Map<number, string[]>;
  color: Map<string, string[]>;
}

/**
 * Labels finished elements with the design tokens that match their computed style,
 * whatever the naming convention or the toolchain that produced them.
 */
export function tokens(options: TokensOptions = {}): SwarmTroopersPlugin {
  let index: Index | null = null;
  const max = options.max ?? 2;
  return {
    name: 'tokens',
    invalidate() {
      index = null;
    },
    label(el, tool) {
      if (!index) index = buildIndex(options);
      return describe(index, el, tool, max);
    },
  };
}

/** Guesses what a token is for from its name. Separators do not matter: --color-text-strong, color.text.strong. */
export function kindOf(raw: string): Kind | null {
  const n = raw.toLowerCase().replace(/[._\s]+/g, '-');
  if (/radius|rounded/.test(n)) return 'radius';
  if (
    /(^|-)(colou?r|bg|background|fg|foreground|ink|surface|border|stroke|fill|brand|accent|gray|grey|neutral|white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-|$)/.test(n) ||
    /text-(strong|primary|secondary|muted|faint|subtle|inverse|default)/.test(n)
  ) {
    return 'color';
  }
  if (/(font-size|fontsize|(^|-)(text|type|fs|heading|display)-)/.test(n)) return 'font';
  if (/(^|-)(space|spacing|gap|gutter|padding|pad|margin|inset|stack|size)(-|$)/.test(n)) return 'space';
  return null;
}

/** Role of a colour, used to prefer the token named after that role. */
export type ColorRole = 'text' | 'background' | 'border';

const ROLE_HINTS: Record<ColorRole, RegExp[]> = {
  text: [/text|copy|content/, /fg|foreground|ink|on-/],
  background: [/bg|background|surface|canvas|fill/, /layer|card|panel/],
  border: [/border|line|stroke|divider|outline/, /edge|separator/],
};

/**
 * Prefers semantic names (--color-text-strong) over primitives (--gray-0) and short aliases (--white),
 * and names that match the role of the colour when one is given.
 */
export function pickName(names?: readonly string[], role?: ColorRole): string | null {
  if (!names || !names.length) return null;
  const score = (n: string): number => {
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

/** Flattens a flat or DTCG token object into [name, kind, css value]. Aliases like {color.base.white} are resolved. */
export function flatten(src: Record<string, unknown>): Array<[string, Kind, string]> {
  const flat = new Map<string, { value: unknown; type?: string }>();
  const visit = (node: unknown, path: string[], inherited?: string): void => {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const obj = node as Record<string, unknown>;
      const type = typeof obj.$type === 'string' ? obj.$type : inherited;
      if ('$value' in obj) {
        flat.set(path.join('.'), { value: obj.$value, type });
        return;
      }
      for (const [k, v] of Object.entries(obj)) if (!k.startsWith('$')) visit(v, [...path, k], type);
      return;
    }
    if (typeof node === 'string' || typeof node === 'number') flat.set(path.join('.'), { value: node, type: inherited });
  };
  visit(src, []);
  const resolve = (v: unknown, depth = 0): unknown => {
    if (typeof v === 'string' && /^\{[^}]+\}$/.test(v) && depth < 8) {
      const ref = flat.get(v.slice(1, -1));
      return ref ? resolve(ref.value, depth + 1) : v;
    }
    return v;
  };
  const out: Array<[string, Kind, string]> = [];
  for (const [name, { value, type }] of flat) {
    let v = resolve(value);
    if (v && typeof v === 'object') {
      const o = v as { hex?: unknown; value?: unknown; unit?: unknown };
      if (typeof o.hex === 'string') v = o.hex;
      else if (typeof o.value === 'number' && typeof o.unit === 'string') v = `${o.value}${o.unit}`;
    }
    if (typeof v === 'number') v = `${v}px`;
    if (typeof v !== 'string') continue;
    const kind: Kind | null = type === 'color' ? 'color' : kindOf(name) ?? (type === 'dimension' ? 'space' : null);
    if (kind) out.push([name, kind, v]);
  }
  return out;
}

function customProperties(): string[] {
  const names = new Set<string>();
  const rootSelector = /(^|,)\s*(:root|html)\s*(?=,|$)/;
  const walk = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule;
      if (styleRule.style && styleRule.selectorText && rootSelector.test(styleRule.selectorText)) {
        for (const p of Array.from(styleRule.style)) if (p.startsWith('--')) names.add(p);
      }
      const inner = (rule as CSSGroupingRule).cssRules;
      if (inner && inner.length) walk(inner);
    }
  };
  const sheets = [...Array.from(document.styleSheets), ...(document.adoptedStyleSheets ?? [])];
  for (const sheet of sheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin stylesheet: not readable */
    }
  }
  for (const p of Array.from(document.documentElement.style)) if (p.startsWith('--')) names.add(p);
  return [...names];
}

const push = <K>(map: Map<K, string[]>, key: K, name: string): void => {
  const list = map.get(key);
  if (list) list.push(name);
  else map.set(key, [name]);
};

/** Resolves every token through the browser itself, so clamp(), rem, color-mix() and aliases all work. */
function buildIndex(o: TokensOptions): Index {
  const idx: Index = { font: new Map(), space: new Map(), radius: new Map(), color: new Map() };
  const entries: Array<[string, Kind, string]> = [];
  if (o.css !== false) {
    for (const name of customProperties()) {
      const k = kindOf(name);
      if (k) entries.push([name, k, `var(${name})`]);
    }
  }
  if (o.source) entries.push(...flatten(o.source));
  if (!entries.length) return idx;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Sentinel values: an invalid token falls back to them and is ignored.
  host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;color:rgb(1, 2, 3);font-size:1.25px;width:333px';
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  host.appendChild(probe);
  document.body.appendChild(host);
  try {
    for (const [name, kind, value] of entries) {
      if (kind === 'color') {
        probe.style.color = value;
        const v = getComputedStyle(probe).color;
        probe.style.color = '';
        if (v && v !== 'rgb(1, 2, 3)' && !/,\s*0\)$|\/\s*0\)$/.test(v)) push(idx.color, v, name);
      } else if (kind === 'font') {
        probe.style.fontSize = value;
        const v = parseFloat(getComputedStyle(probe).fontSize);
        probe.style.fontSize = '';
        if (v && Math.abs(v - 1.25) > 0.01) push(idx.font, Math.round(v * 10) / 10, name);
      } else {
        probe.style.width = value;
        const v = parseFloat(getComputedStyle(probe).width);
        probe.style.width = '';
        if (v > 0) push(idx[kind], Math.round(v * 10) / 10, name);
      }
    }
  } finally {
    host.remove();
  }
  return idx;
}

function nearest(map: Map<number, string[]>, value: number, tolerance: number): string | null {
  if (!value) return null;
  let best: string[] | undefined;
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

function describe(idx: Index, el: SwarmTroopersElement, tool: string, max: number): string | null {
  const cs = getComputedStyle(el);
  const out: string[] = [];
  const add = (s: string | null): void => {
    if (s && out.length < max && !out.includes(s)) out.push(s);
  };
  if (tool === 'type') {
    add(nearest(idx.font, parseFloat(cs.fontSize), 0.6));
    add(pickName(idx.color.get(cs.color), 'text'));
  } else if (tool === 'rule') {
    add(pickName(idx.color.get(cs.backgroundColor), 'border') ?? pickName(idx.color.get(cs.borderTopColor), 'border'));
  } else {
    add(nearest(idx.radius, parseFloat(cs.borderTopLeftRadius), 0.5));
    add(pickName(idx.color.get(cs.backgroundColor), 'background'));
    add(nearest(idx.space, parseFloat(cs.paddingTop), 0.5));
    add(pickName(idx.color.get(cs.borderTopColor), 'border'));
  }
  return out.length ? out.join(' · ') : null;
}
