---
name: swarmtroopers-overlay
description: Integrate Swarm Troopers' coordinated cursor animations into an existing website, preserving its content, styles and lifecycle. Use when adding Swarm Troopers or replacing a reveal effect with named cursor agents.
metadata:
  version: "0.5.0"
  author: Hugo Mourlevat
---

# Swarm Troopers overlay

Install the tested engine; do not copy or regenerate its internals for each site. HTML remains the source of truth. Without JavaScript, with motion Off, or after an animation failure, the original content must remain usable.

## Inspect before changing the host

- Identify the package manager, rendering stack, actual root, route lifecycle, CSP, existing reveal effects, scrolling model, and essential controls.
- Confirm the requested root exists after mount. An explicitly missing root is an error; do not broaden the target to `body` to make it work.
- Supported baseline: light DOM in the current document, normal viewport coordinates, modern Canvas 2D/CSS/observer APIs. Shadow-tree roots and document transforms that move the overlay use visible passthrough with a warning. Do not promise animation in those environments.
- Prefer a focused demonstration or noncritical content region. Exclude checkout controls, critical reading content, and LCP-critical hero content. Explicit user choices take priority; explain an unsupported case instead of silently changing their intent.
- Auto mode leaves interactive controls and their enclosing boxes visible. Use `data-swarmtroopers-skip` to exclude other animation owners. Do not remove a site's existing effects or clip-paths merely to simplify integration.

## Install and integrate

Install with the site's package manager (`npm i swarmtroopers`), or use the no-build script tag from a pinned CDN, `https://unpkg.com/swarmtroopers@0.5.0/dist/swarmtroopers.core.iife.js`, or self-host by copying `dist/swarmtroopers.core.iife.js` from `node_modules/swarmtroopers`. The skill itself installs with `npx swarmtroopers skill`. Do not invent other packages, CDNs, domains, or deployments.

Choose the build deliberately:

- `dist/swarmtroopers.core.iife.js`: lightweight, self-contained script; the finale draws vector hands in the two agents' colors.
- `dist/swarmtroopers.iife.js`: self-contained full script with the supplied hand artwork (two illustrated hands embedded as `data:` URLs).
- ESM: import `create` and `controls` from `swarmtroopers`. Add `import 'swarmtroopers/finale'` only when the illustrated hands are wanted. For a no-bundler ESM installation, copy the complete `dist` directory and keep its chunks adjacent.
- CommonJS: `swarmtroopers` for core, `swarmtroopers/full` for the artwork profile.

Use auto mode for a semantic content region. Use `data-swarmtroopers="type|frame|rule|stamp"`, `data-swarmtroopers="repeat"`, or `data-swarmtroopers="scan"` when the selection needs deliberate control.

```html
<script src="/vendor/swarmtroopers.core.iife.js"
  data-swarmtroopers-init='{"root":"#demo","auto":true,"controls":true}'></script>
```

Create one instance after its root mounts, and destroy it on unmount or full route replacement. Overlapping instances are refused. Use `refresh()` for added/removed descendants inside the same mounted root; it does not replay known elements or detect in-place text changes automatically. See [integration recipes](references/integrations.md) for framework lifecycles.

Keep named identities and the Swarm Troopers palette unless the user requests a change. Use `locale`, `names`, `leadName`, and translated control labels where appropriate. `maxTasks` bounds enrolled work; overflow remains visible. Do not raise it to hide an integration defect.

## Optional preload

Omit preload by default. Add it only when the user wants an anti-flash effect and it fits the page's loading and CSP constraints. The packaged `snippet/preload.html` uses explicit `data-swarmtroopers-preload` opt-ins, never all of `main`. Do not mark critical content. Keep its timeout and the correct storage prefix. Essential controls and skipped descendants must stay visible even if a container is marked accidentally.

## Verify observable behavior

- Compare with the original page: content, semantics and host styles remain intact; original clip-path values and priorities survive.
- Test normal motion, initial and changed system preferences, the Off switch, keyboard Tab/focus, printing, and no JavaScript.
- Finish the real build and check task completion, no remaining Swarm Troopers-owned pending states, and no uncaught errors.
- Destroy mid-build; confirm no residual canvas/dock and no Swarm Troopers-owned clip. Do not delete legitimate host styles.
- Navigate away and back in the actual client application. Confirm one live instance, one dock, and clean teardown. In React, include Strict Mode's setup/cleanup cycle.
- Check the site's target viewport sizes, nested scrolling and CSP. The tested Chrome/Firefox/Playwright-WebKit and React baseline does not establish actual Safari, every framework, assistive-technology behavior, or physical-device performance.
- Check failed script loading when preload is used. The original content must become visible without the engine.

Deliver the changed files, chosen build/mode, exclusions, test evidence, and remaining limitations. Publishing the website or repository requires the user's authorization; adding Swarm Troopers does not imply it.
