import { create } from './index.js';
import { controls, type ControlsOptions } from './controls.js';
import type { SwarmTroopersOptions } from './types.js';
import { validateOptions } from './options.js';

export * from './index.js';
export { SwarmTroopersOverlayElement, defineElement } from './element.js';

/**
 * <script src="swarmtroopers.iife.js" data-swarmtroopers-init='{"auto": true, "controls": true}'></script>
 * starts an instance as soon as the document is ready. Without the attribute, nothing happens:
 * use window.SwarmTroopers.create() or the <swarmtroopers-overlay> element.
 */
const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
const raw = script?.getAttribute('data-swarmtroopers-init');

if (raw != null) {
  let config: SwarmTroopersOptions & { controls?: boolean | ControlsOptions } = {};
  let valid = true;
  try {
    const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
    validateOptions(parsed);
    config = parsed;
  } catch (err) {
    valid = false;
    document.documentElement.classList.remove('swarmtroopers-preload');
    console.warn('[swarmtroopers] invalid initialization options; content unchanged', err);
  }
  const boot = (): void => {
    let swarmtroopers: ReturnType<typeof create> | undefined;
    try {
      const { controls: ui, ...options } = config;
      swarmtroopers = create(options);
      if (ui) controls(swarmtroopers, typeof ui === 'object' ? ui : {});
      (window as unknown as { swarmtroopers: typeof swarmtroopers }).swarmtroopers = swarmtroopers;
      window.dispatchEvent(new CustomEvent('swarmtroopers-ready', { detail: swarmtroopers }));
    } catch (error) {
      swarmtroopers?.destroy();
      document.documentElement.classList.remove('swarmtroopers-preload');
      console.warn('[swarmtroopers] could not initialize; content restored', error);
    }
  };
  if (valid && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else if (valid) queueMicrotask(boot);
}
