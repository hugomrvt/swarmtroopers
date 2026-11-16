import type { SwarmTroopers } from './swarmtroopers.js';
import type { Quality } from './types.js';
import markSource from '../assets/swarmtroopers-mark-sm.svg';

export interface ControlsOptions {
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  labels?: Partial<Record<'title' | Quality, string>>;
  container?: Element;
}

/** A small switch that lets the reader choose Full, Light or Off. The choice is remembered. */
export function controls(swarmtroopers: SwarmTroopers, options: ControlsOptions = {}): HTMLElement {
  const text = { title: 'swarmtroopers', full: 'Full', light: 'Light', off: 'Off', ...options.labels };
  const box = document.createElement('div');
  box.className = 'swarmtroopers-controls';
  box.dataset.pos = options.position ?? 'bottom-left';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', text.title);
  const { rgb, text: ink } = swarmtroopers.theme;
  box.style.color = ink;
  box.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  box.style.setProperty('--st-on', box.style.background);

  const title = document.createElement('span');
  title.className = 'swarmtroopers-controls-title';
  const mark = document.createElement('img');
  mark.addEventListener('error', () => mark.remove(), { once: true });
  mark.src = markSource;
  mark.alt = '';
  mark.width = mark.height = 20;
  title.append(document.createTextNode(text.title), mark);
  box.appendChild(title);

  const buttons = (['full', 'light', 'off'] as const).map((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text[q];
    b.addEventListener('click', () => swarmtroopers.setQuality(q));
    box.appendChild(b);
    return { q, b };
  });
  const sync = (): void => {
    for (const { q, b } of buttons) b.setAttribute('aria-pressed', String(swarmtroopers.quality === q));
  };
  sync();
  swarmtroopers.on('quality', sync);

  (options.container ?? document.body).appendChild(box);
  swarmtroopers.own(box);
  return box;
}
