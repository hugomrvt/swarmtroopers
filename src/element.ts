import { SwarmTroopers } from './swarmtroopers.js';
import { controls, type ControlsOptions } from './controls.js';
import type { SwarmTroopersOptions, QualitySetting, Trigger } from './types.js';

// Server-side rendering has no HTMLElement: the class still has to be declarable there.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * Declarative use, from any template language or framework:
 * <swarmtroopers-overlay auto inspect tokens controls quality="light" trigger="scroll" root="main"></swarmtroopers-overlay>
 */
export class SwarmTroopersOverlayElement extends Base {
  swarmtroopers: SwarmTroopers | null = null;
  private pendingStart: (() => void) | null = null;

  connectedCallback(): void {
    this.style.display = 'none';
    if (this.swarmtroopers) return;
    const on = (name: string): boolean => this.hasAttribute(name) && this.getAttribute(name) !== 'false';
    // An unreadable value falls back to the default, like any HTML attribute, instead of failing the whole element.
    const positive = (name: string): number | undefined => {
      const value = parseFloat(this.getAttribute(name) ?? '');
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const choice = <T extends string>(name: string, values: readonly T[]): T | undefined => values.find((value) => value === this.getAttribute(name));
    const options: SwarmTroopersOptions = {
      root: this.getAttribute('root'),
      selector: this.getAttribute('selector') ?? undefined,
      auto: on('auto'),
      inspect: on('inspect'),
      labels: this.getAttribute('labels') !== 'false',
      quality: choice<QualitySetting>('quality', ['auto', 'full', 'light', 'off']),
      trigger: choice<Trigger>('trigger', ['immediate', 'scroll', 'manual']),
      speed: positive('speed'),
      once: this.getAttribute('once') === 'session' ? 'session' : false,
      plugins: on('tokens') ? ['tokens'] : [],
      chat: this.hasAttribute('chat') && this.getAttribute('chat') !== 'false',
      locale: this.getAttribute('lang') || undefined,
      names: names(this.getAttribute('names')),
      finale: this.getAttribute('finale') !== 'false',
      scale: positive('scale'),
    };
    const start = (): void => {
      if (this.pendingStart !== start) return;
      this.pendingStart = null;
      if (!this.isConnected || this.swarmtroopers) return;
      try {
        this.swarmtroopers = new SwarmTroopers(options);
        if (on('controls')) {
          const value = this.getAttribute('controls') ?? '';
          const position = /^(bottom|top)-(left|right)$/.test(value) ? (value as ControlsOptions['position']) : undefined;
          controls(this.swarmtroopers, { position });
        }
        this.dispatchEvent(new CustomEvent('swarmtroopers-ready', { detail: this.swarmtroopers, bubbles: true }));
      } catch (error) {
        this.swarmtroopers?.destroy();
        this.swarmtroopers = null;
        document.documentElement.classList.remove('swarmtroopers-preload');
        console.warn('[swarmtroopers] custom element could not initialize; content restored', error);
      }
    };
    this.pendingStart = start;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    }
    else queueMicrotask(start);
  }

  disconnectedCallback(): void {
    if (this.pendingStart) document.removeEventListener('DOMContentLoaded', this.pendingStart);
    this.pendingStart = null;
    this.swarmtroopers?.destroy();
    this.swarmtroopers = null;
  }
}

export function defineElement(name = 'swarmtroopers-overlay'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) customElements.define(name, SwarmTroopersOverlayElement);
}

defineElement();

/** names="false" hides the tags, names="Ada, Léo, Mia" gives the workers' first names. */
function names(value: string | null): boolean | string[] {
  if (value === 'false') return false;
  const list = (value ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  return list.length > 1 ? list : true;
}
