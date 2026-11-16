# Integration recipes

Choose the recipe matching the site's actual mounted content. These examples use the published package `swarmtroopers`; install it first with `npm i swarmtroopers`.

## Static HTML and CMS custom code

Serve the chosen script from the site's approved origin, after the target region exists. Add required CSP nonces/hashes through the site's existing mechanism.

```html
<section id="demo"><h2 data-swarmtroopers="type">Existing content</h2></section>
<script src="/vendor/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{"root":"#demo","controls":true}'></script>
```

Choose `swarmtroopers.iife.js` instead when the supplied layered artwork is wanted. Do not load both profiles on one page.

## React / Next.js

```jsx
'use client';
import { useEffect } from 'react';
import { create, controls } from 'swarmtroopers';

export function SwarmTroopersOverlay({ routeKey }) {
  useEffect(() => {
    const swarmtroopers = create({ root: '#demo', auto: true });
    controls(swarmtroopers);
    return () => swarmtroopers.destroy();
  }, [routeKey]);
  return null;
}
```

Pass the actual route identity, for example Next's `usePathname()`, only after that route's content has mounted. Streamed or suspended content may need a component-local ref and an explicit refresh after descendants arrive. Do not use a global route listener as a substitute for mounted DOM. Optional artwork: import `swarmtroopers/finale` in the client integration module. The repository's React browser fixture verifies Strict Mode and repeated route changes in Chrome, Firefox and Playwright WebKit; it does not validate every Next.js streaming pattern.

## Vue / Nuxt

Create in `onMounted`, destroy in `onBeforeUnmount`. Nuxt integrations belong in a `.client.vue` component or `<ClientOnly>`. If a persistent layout survives route changes, subscribe after the target DOM update and destroy/recreate deliberately. Do not create another instance merely because the pathname changed.

## Svelte / SvelteKit

Create in `onMount` and return `() => swarmtroopers.destroy()`. For persistent layouts, handle the framework's post-navigation lifecycle after the actual root updates. Use refresh only for descendants retained in the same view.

## Astro

With client-side navigation, create after `astro:page-load` and destroy before `astro:before-swap`. A module-scoped instance and one registered pair of listeners prevent duplicate mounts. For an ordinary static page, one startup after DOM readiness is enough.

## Angular

Create after the target view exists in `ngAfterViewInit`, using `ngZone.runOutsideAngular`. Destroy in `ngOnDestroy`. Route reuse and delayed view content require explicit lifecycle handling.

## Portable failure behavior

Invalid options are rejected before host mutations. Unsupported roots or renderer startup failures leave original content visible with quality Off and a diagnostic. Extension failures settle the failed task or restore the host if rendering cannot safely continue. Verify this behavior on the chosen site; do not suppress diagnostics to make a checklist pass.
