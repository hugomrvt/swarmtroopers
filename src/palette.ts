import type { PaletteSpec } from './types.js';

export type RGB = [number, number, number];

/** OKLCH to sRGB (0 to 255). Returns null when the colour falls outside the sRGB gamut. */
export function oklchToRgb(l: number, c: number, hueDeg: number): RGB | null {
  const h = (hueDeg * Math.PI) / 180;
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
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const out: number[] = [];
  for (const v of linear) {
    if (v < -0.0005 || v > 1.0005) return null;
    const x = Math.min(1, Math.max(0, v));
    out.push(Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255));
  }
  return out as RGB;
}

export const toHex = (c: RGB): string => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

/** Golden-angle hue steps keep consecutive agents easy to tell apart. Chroma drops until each colour fits sRGB. */
export function buildPalette(spec: PaletteSpec = {}): string[] {
  const { hue = 40, count = 8, lightness = 0.72, chroma = 0.16 } = spec;
  const out: string[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const h = (((hue + i * 137.508) % 360) + 360) % 360;
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

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: RGB): number {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

let probe: CanvasRenderingContext2D | null = null;

/** Resolves any colour the browser understands (lab, oklch, color-mix…) to sRGB through a 1×1 canvas. */
export function cssToRgba(css: string): [number, number, number, number] {
  if (!probe) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    probe = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) return [255, 255, 255, 1];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

/** Background colour the reader actually sees behind the content. */
export function pageBackground(): RGB {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const [r, g, b, a] = cssToRgba(getComputedStyle(el).backgroundColor);
    if (a > 0.5) return [r, g, b];
  }
  return [255, 255, 255];
}
