import type { Agent } from './model.js';
import type { Point, Rect } from './types.js';
import { cssToRgba, relativeLuminance } from './palette.js';
import { CLAP_FRAMES, CLAP_TIMES } from './clap.js';

export type AnnotationKind = 'drag' | 'select' | 'ghost' | 'line' | 'caret' | 'ripple' | 'zone' | 'spark';

export interface AnnotationInit {
  kind: AnnotationKind;
  rect?: () => Rect;
  a?: () => Point;
  b?: () => Point;
  label?: string;
  /** Seconds before it fades out on its own. Infinite by default. */
  ttl?: number;
  color?: string;
}

export interface Annotation {
  kind: AnnotationKind;
  rect?: () => Rect;
  a?: () => Point;
  b?: () => Point;
  label?: string;
  color: string;
  ttl: number;
  age: number;
  /** Fade-out progress, 0 to 1. */
  out: number;
  closed: boolean;
  done(): void;
}

/** The orchestrator is drawn a little larger than its workers. */
const LEAD = 1.2;

const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** The closing high five. Ages in seconds; `close` counts from a dismissal, 0 while it plays. */
export interface Finale {
  age: number;
  close: number;
  /** Where the hands meet, in viewport pixels. */
  at: { x: number; y: number };
  left: { name: string; color: string };
  right: { name: string; color: string };
}

/** Timeline of the finale, in seconds. */
const F = { veil: 0.24, enter: 0.12, meet: 0.86, hold: 3.12, out: 0.42 };
export const FINALE_END = F.hold + F.out;
export const FINALE_OUT = 0.3;

const unit = (t: number): number => Math.min(1, Math.max(0, t));
const easeOut = (t: number): number => 1 - Math.pow(1 - unit(t), 3);

/** Hands wind up, make contact, then rebound once; the contact frame stays exact at every frame rate. */
export function finalePose(age: number): { spread: number; tilt: number; lift: number; impact: number } {
  const approach = easeOut((age - F.enter) / 0.4);
  const strike = unit((age - 0.66) / (F.meet - 0.66));
  const settle = unit((age - F.meet - 0.06) / 0.5);
  const recoil = Math.sin(settle * Math.PI) * Math.exp(-settle * 2);
  return {
    spread: age < 0.66 ? 12 + 74 * (1 - approach) : age < F.meet ? 12 * (1 - strike * strike) : 3.5 * recoil,
    tilt: age < F.meet ? -0.18 * (1 - strike) : 0.035 * recoil,
    lift: age < F.meet ? 9 * Math.sin(approach * Math.PI) : 5 * recoil,
    impact: age >= F.meet ? 1 - unit((age - F.meet) / 0.46) : 0,
  };
}

/** Look of the overlay, read from the page. */
export interface OverlayStyle {
  /** Page background, used for halos and bubble fills. */
  halo: string;
  /** Page text colour, used in bubbles. */
  ink: string;
  /** Font family of the page, used for names and bubbles. */
  sans: string;
  /** Size multiplier for pointers, tags, bubbles and labels. */
  scale: number;
}

/** A single fixed canvas over the page. Cheap to composite, cleared only when something was drawn. */
export class Overlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dart: Path2D;
  private palm: Path2D;
  private slap: Path2D;
  private clap: HTMLImageElement[] = [];
  private dpr = 1;
  private w = 0;
  private h = 0;
  private painted = true;
  private widths = new Map<string, number>();
  private wraps = new Map<string, string[]>();
  private contrast = new Map<string, string>();
  private st: OverlayStyle = { halo: '#fff', ink: '#111', sans: 'system-ui, sans-serif', scale: 1 };
  /** Opacity of the working troopers as the completion stage enters. */
  private mul = 1;

  constructor(z: number, private cap: number) {
    const c = document.createElement('canvas');
    c.className = 'swarmtroopers-overlay';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
    document.body.appendChild(c);
    try {
      const origin = c.getBoundingClientRect();
      // innerHeight includes a classic horizontal scrollbar, the fixed canvas does not: compare with the layout viewport.
      const viewport = (document.compatMode === 'BackCompat' ? document.body : document.documentElement).clientHeight;
      if (Math.abs(origin.x) > 1 || Math.abs(origin.y) > 1 || Math.abs(origin.width - c.clientWidth) > 1 || Math.abs(origin.height - c.clientHeight) > 1 || Math.abs(c.clientHeight - viewport) > 1) throw new Error('[swarmtroopers] a transformed document prevents viewport overlay alignment');
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('[swarmtroopers] 2D canvas is not available');
      this.canvas = c;
      this.ctx = ctx;
      // A rounded arrow with a distinct neck; its tip stays on the actual hotspot.
      this.dart = new Path2D('M0 0 L5.1 17.4 Q5.4 18.5 6.2 17.6 L9.5 12.2 L15.2 10.5 Q16.4 10.1 15.2 9.4 Z');
      this.palm = new Path2D('M-4 13 L-4.7 8 Q-5 6-7 4 L-10.3-0.3 Q-11.8-2.6-9.8-3.4 Q-8.5-3.9-7.1-2 L-5.7-0.1 L-6.2-10 Q-6.3-12.8-4.4-12.8 Q-2.6-12.8-2.5-10 L-2.1-4.3 L-2.2-14 Q-2.2-16.7-0.2-16.7 Q1.7-16.7 1.7-14 L1.7-4.8 L2.3-12.3 Q2.5-14.8 4.3-14.4 Q6-14.2 5.8-11.8 L5.2-3.4 L6.2-8.5 Q6.7-10.7 8.3-10.1 Q9.7-9.6 9.2-7.4 L7.6 0.8 Q7.2 3.2 6.4 5.2 Q5.5 7.7 5.2 13 Z');
      // The flat inner edge is the palm-to-palm contact line; the wrists stay separated.
      this.slap = new Path2D('M0 7 L0-14.5 C0-18.8-4.2-18.8-4.8-14.5 L-5.8-5.8 L-5.8-12.1 C-5.8-15.5-9.3-15.5-9.9-12.1 L-11-4 L-11-8.7 C-11-11.8-14.2-11.8-14.7-8.5 L-15.6-0.5 L-15.8-4.9 C-16-7.3-18.5-7.1-18.6-4.4 L-18.6 2 L-21-0.5 C-23.2-2.7-25.6 0-23.4 2.5 L-17.8 9 C-16.7 10.3-15.1 11.7-14.7 13.5 L-17.3 17 L-9 21 L-4.6 14.4 C-1.6 12.4 0 10.7 0 7 Z');
      this.resize();
    } catch (error) {
      c.remove();
      throw error;
    }
  }

  prepareFinale(): void {
    if (this.clap.length) return;
    this.clap = CLAP_FRAMES.map((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      void image.decode().catch(() => undefined);
      return image;
    });
  }

  setCap(cap: number): void {
    this.cap = cap;
    this.resize();
  }

  resize(): void {
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

  destroy(): void {
    this.canvas.remove();
  }

  render(anns: readonly Annotation[], agents: readonly Agent[], sx: number, sy: number, style: OverlayStyle, fin: Finale | null = null): void {
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
    // A worker right on the orchestrator (leaving its hand, coming back) shows no tag, the two would overlap.
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
  private finale(f: Finale): void {
    this.prepareFinale();
    const { ctx } = this;
    const out = f.close ? unit(f.close / FINALE_OUT) : unit((f.age - F.hold) / F.out);
    const life = (1 - out) * easeOut(f.age / F.veil);
    if (life <= 0) return;
    // Sprite pixels are drawn 2× and never smoothed.
    const z = 2;
    const size = 49 * z;
    // Room for the name tags on each side.
    const mx = Math.min(this.w / 2, size + 64);
    const cx = Math.min(this.w - mx, Math.max(mx, f.at.x));
    const cy = Math.min(this.h - size - 30, Math.max(size, f.at.y));
    const sprite = this.clap.every((image) => image.complete && image.naturalWidth > 0);
    ctx.save();
    ctx.globalAlpha = life * easeOut((f.age - F.enter) / 0.18);
    if (sprite) {
      let i = 0;
      while (i < CLAP_TIMES.length - 1 && f.age >= CLAP_TIMES[i + 1]) i++;
      // A two-frame shake on the slap, one sprite pixel each way.
      const hit = f.age - CLAP_TIMES[3];
      const shake = i === 3 && hit < 0.08 ? (Math.floor(hit / 0.04) % 2 ? z : -z) : 0;
      const image = this.clap[i];
      const w = image.naturalWidth * z;
      const h = image.naturalHeight * z;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, Math.round(cx - w / 2 + shake), Math.round(cy - h / 2), w, h);
    } else {
      // A decode failure (strict img-src CSP) still gets a clap: vector hands in the troopers' colours.
      const v = 76;
      const pose = finalePose(f.age);
      // The pose was authored for hands about 100 px wide.
      const s = v / 100;
      const pop = 1 + 0.1 * pose.impact;
      const k = v / 46;
      for (const [side, color] of [[-1, f.left.color], [1, f.right.color]] as const) {
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
        ctx.lineCap = 'round';
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
    // Name tags right under the hands, like cursor tags.
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
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + tw / 2, tagsY + 11);
    }
    ctx.restore();
  }

  private measure(text: string, font: string): number {
    const key = font + '|' + text;
    let w = this.widths.get(key);
    if (w === undefined) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      if (this.widths.size > 2000) this.widths.clear();
      this.widths.set(key, w);
    }
    return w;
  }

  /** Dark or light text, whichever reads better on the agent colour. */
  private textOn(color: string): string {
    let c = this.contrast.get(color);
    if (!c) {
      const [r, g, b] = cssToRgba(color);
      const luminance = relativeLuminance([r, g, b]);
      c = (luminance + 0.05) / (relativeLuminance([13, 14, 17]) + 0.05) >= 1.05 / (luminance + 0.05) ? '#0d0e11' : '#ffffff';
      this.contrast.set(color, c);
    }
    return c;
  }

  private fit(text: string, font: string, width: number): string {
    if (this.measure(text, font) <= width) return text;
    const chars = Array.from(text);
    let low = 0;
    let high = chars.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.measure(chars.slice(0, mid).join('') + '…', font) <= width) low = mid;
      else high = mid - 1;
    }
    return chars.slice(0, low).join('').trimEnd() + '…';
  }

  /** A presence tab and a separate task caption keep identity stable while work changes. */
  private tag(a: Agent, sx: number, sy: number): void {
    const k = this.st.scale * (a.lead ? LEAD : 1);
    const { ctx } = this;
    const base = a.dim ? Math.max(0.85, a.alpha) : a.alpha;
    if (base <= 0.02 || (a.shape === 'hand' && !a.lead)) return;
    const font = `650 ${(10.5 * k).toFixed(1)}px ${this.st.sans}`;
    const taskFont = `500 ${(10 * k).toFixed(1)}px ${this.st.sans}`;
    const max = Math.max(32, Math.min(220 * k, this.w - 24));
    const name = this.fit(a.name, font, max - 18 * k);
    const h = 20 * k;
    const w = this.measure(name, font) + 18 * k;
    const doing = a.doing;
    const caption = doing ? this.fit(doing.text, taskFont, max - 16 * k) : '';
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
    ctx.textBaseline = 'middle';
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

  private wrap(text: string, font: string, max: number): string[] {
    const key = font + '|' + max + '|' + text;
    let lines = this.wraps.get(key);
    if (lines) return lines;
    lines = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && this.measure(next, font) > max) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
    lines = lines.map((line) => this.fit(line, font, max));
    if (this.wraps.size > 500) this.wraps.clear();
    this.wraps.set(key, lines);
    return lines;
  }

  /** Speech bubble above the name tag, with a tail pointing at the agent. */
  private bubble(a: Agent, sx: number, sy: number): void {
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
    // Above-right of the pointer, flipped to the left near the right edge, kept on screen.
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
    // Body and tail.
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
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + padX, y + padY + lh * (i + 0.5)));
    ctx.restore();
  }

  private annotation(n: Annotation, sx: number, sy: number, halo: string): void {
    const { ctx } = this;
    const alpha = 1 - Math.min(1, n.out);
    if (alpha <= 0) return;
    ctx.globalAlpha = this.mul * alpha;
    ctx.strokeStyle = n.color;
    ctx.fillStyle = n.color;
    switch (n.kind) {
      case 'drag':
      case 'ghost': {
        if (!n.rect) return;
        const r = normalise(n.rect());
        const x = r.x - sx;
        const y = r.y - sy;
        if (!this.onScreen(x, y, r.w, r.h)) return;
        ctx.globalAlpha = this.mul * alpha * (n.kind === 'ghost' ? 0.1 : 0.07);
        ctx.fillRect(x, y, r.w, r.h);
        ctx.globalAlpha = this.mul * alpha * (n.kind === 'ghost' ? 0.75 : 1);
        ctx.lineWidth = 1;
        ctx.setLineDash(n.kind === 'ghost' ? [4, 3] : []);
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
        ctx.setLineDash([]);
        if (n.kind === 'drag' && r.w > 10 && r.h > 10) this.handles(x, y, r.w, r.h, n.color, halo);
        return;
      }
      case 'select': {
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
      case 'line': {
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
      case 'caret': {
        if (!n.a || !n.b) return;
        const a = n.a();
        const b = n.b();
        ctx.fillRect(a.x - sx - 1, a.y - sy, 2, Math.max(2, b.y - a.y));
        return;
      }
      case 'zone': {
        // The area a squad works on: a light dashed outline, no fill.
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
      case 'spark': {
        // A few short strokes bursting out where two hands meet.
        if (!n.a) return;
        const p = n.a();
        const t = Math.min(1, n.age / Math.max(0.01, n.ttl));
        const k = this.st.scale;
        const ease = 1 - (1 - t) * (1 - t);
        ctx.globalAlpha = this.mul * alpha * (1 - t);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
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
      case 'ripple': {
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

  private handles(x: number, y: number, w: number, h: number, color: string, halo: string): void {
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

  private label(text: string, x: number, below: number, above: number, color: string, halo: string, alpha: number): void {
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
    ctx.textBaseline = 'middle';
    ctx.fillText(content, lx + 6 * s, ly + h / 2 + 0.5);
  }

  private pointer(a: Agent, sx: number, sy: number, halo: string): void {
    const x = a.x - sx;
    const y = a.y - sy;
    if (a.alpha <= 0.01 || x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = this.mul * a.alpha;
    ctx.translate(x, y);
    const s = (1 - a.press * 0.12) * this.st.scale * (a.lead ? LEAD : 1);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (a.shape === 'hand') {
      ctx.scale(1.3, 1.3);
      this.hand(a.flip, a.color, halo);
    } else if (a.shape === 'beam' || a.shape === 'cross') {
      ctx.beginPath();
      if (a.shape === 'beam') {
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
      if (a.shape === 'cross') {
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
      if (a.shape === 'stamp') {
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
  private highFiveHand(color: string): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.fill(this.slap);
    ctx.strokeStyle = this.textOn(color);
    ctx.lineWidth = 0.65;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
  private hand(flip: boolean, color: string, halo: string): void {
    const { ctx } = this;
    ctx.scale(flip ? -1 : 1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
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

  private onScreen(x: number, y: number, w: number, h: number): boolean {
    return x + w >= -20 && y + h >= -20 && x <= this.w + 20 && y <= this.h + 20;
  }
}

function normalise(r: Rect): Rect {
  return { x: r.w < 0 ? r.x + r.w : r.x, y: r.h < 0 ? r.y + r.h : r.y, w: Math.abs(r.w), h: Math.abs(r.h) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
