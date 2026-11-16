import { afterEach, expect, it, vi } from 'vitest';
import { SwarmTroopersOverlayElement, defineElement } from '../src/element';

afterEach(() => vi.unstubAllGlobals());

it('registers the element tag once', () => {
  const registry = new Map<string, CustomElementConstructor>();
  const define = vi.fn((name: string, ctor: CustomElementConstructor) => registry.set(name, ctor));
  vi.stubGlobal('customElements', { get: (name: string) => registry.get(name), define });
  defineElement();
  defineElement();
  expect(define).toHaveBeenCalledTimes(1);
  expect(registry.get('swarmtroopers-overlay')).toBe(SwarmTroopersOverlayElement);
  expect(new SwarmTroopersOverlayElement().swarmtroopers).toBeNull();
});
