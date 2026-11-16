import type { SwarmTroopersElement } from './types.js';
import { clamp } from './util.js';

/** A word, or the part of a word on one line. Offsets are in `seq`, x in element pixels. */
export interface Piece {
  a: number;
  b: number;
  line: number;
  x0: number;
  x1: number;
}

export interface Line {
  top: number;
  bottom: number;
}

/** Geometry of the text of an element, relative to its border box. */
export interface TextGeo {
  /** Words joined by single spaces, in typing order. */
  seq: string;
  pieces: Piece[];
  lines: Line[];
  /** Top of each line's reveal band. */
  bands: number[];
  w: number;
  h: number;
  /** Margin kept around the box so glyph overhangs are not cut. */
  pad: number;
}

export interface ClipState {
  path: string;
  /** Caret position, element pixels. */
  x: number;
  top: number;
  bottom: number;
}

/** Bands between lines. When two line boxes overlap (tight leading), the overlap is split in half. */
export function bandsFor(lines: Line[]): number[] {
  const order = lines.map((_, i) => i).sort((i, j) => lines[i].top - lines[j].top);
  const bands = new Array<number>(lines.length);
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

/** Clip polygon showing every line above the caret, and the current line up to the caret. */
export function clipAt(g: TextGeo, chars: number): ClipState {
  const ps = g.pieces;
  const c = clamp(chars, 0, g.seq.length);
  let lo = 0;
  let hi = ps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
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
  const px = (v: number): string => Math.round(v * 10) / 10 + 'px';
  return {
    path: `polygon(${px(L)} ${px(T)},${px(R)} ${px(T)},${px(R)} ${px(top)},${px(x)} ${px(top)},${px(x)} ${px(line.bottom)},${px(L)} ${px(line.bottom)})`,
    x,
    top: line.top,
    bottom: line.bottom,
  };
}

const WORD = /\S+/g;

/**
 * Reads the real line boxes of an element's text with the Range API, word by word.
 * `skip` excludes text nodes that belong to another task.
 */
export function measureText(el: SwarmTroopersElement, skip: (node: Node) => boolean): TextGeo | null {
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  const raw: Array<{ text: string; r: DOMRect }> = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (skip(node)) continue;
    const data = (node as Text).data;
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
      // A word broken across lines: share its characters between the fragments.
      const total = rects.reduce((s, r) => s + r.width, 0) || 1;
      let used = 0;
      rects.forEach((r, i) => {
        const take = i === rects.length - 1 ? word.length - used : Math.max(1, Math.round((r.width / total) * word.length));
        if (take <= 0) return;
        raw.push({ text: word.slice(used, used + take), r });
        used += take;
      });
    }
  }
  if (!raw.length) return null;

  const lines: Line[] = [];
  const pieces: Piece[] = [];
  let seq = '';
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
    if (seq) seq += ' ';
    const a = seq.length;
    seq += text;
    pieces.push({ a, b: seq.length, line: li, x0: r.left - box.left, x1: r.right - box.left });
  }
  const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
  return { seq, pieces, lines, bands: bandsFor(lines), w: box.width, h: box.height, pad: Math.ceil(fontSize * 0.4) };
}
