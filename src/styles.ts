const CSS = `
.swarmtroopers-pending{opacity:0!important;pointer-events:none!important}
.swarmtroopers-pop{transition:opacity .22s ease-out!important}
.swarmtroopers-settle{animation:swarmtroopers-settle .44s cubic-bezier(.3,1.5,.6,1) both}
@keyframes swarmtroopers-settle{from{opacity:.35;translate:0 -7px;scale:1.03}to{opacity:1;translate:none;scale:none}}
.swarmtroopers-controls{position:fixed;z-index:2147483001;box-sizing:border-box;display:flex;align-items:center;gap:3px;max-width:calc(100vw - 28px);padding:5px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:6px;font:500 12px/1.2 'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;isolation:isolate}
.swarmtroopers-controls[data-pos^=bottom]{bottom:max(14px,env(safe-area-inset-bottom,0px))}
.swarmtroopers-controls[data-pos^=top]{top:max(14px,env(safe-area-inset-top,0px))}
.swarmtroopers-controls[data-pos$=left]{left:max(14px,env(safe-area-inset-left,0px))}
.swarmtroopers-controls[data-pos$=right]{right:max(14px,env(safe-area-inset-right,0px))}
.swarmtroopers-controls .swarmtroopers-controls-title{display:flex;align-items:center;gap:7px;min-width:0;padding:0 12px 0 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.swarmtroopers-controls .swarmtroopers-controls-title img{display:block;flex:none;width:20px;height:20px;object-fit:contain}
.swarmtroopers-controls button{appearance:none;box-sizing:border-box;min-height:40px;min-width:44px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:0;border-radius:6px;margin:0;padding:0 13px;font:inherit;color:inherit;cursor:pointer;transition:background-color 160ms ease,color 160ms ease,transform 120ms ease,box-shadow 160ms ease;-webkit-tap-highlight-color:transparent}
.swarmtroopers-controls button[aria-pressed=true]{background:var(--st-fg,currentColor);color:var(--st-on,#fff)}
.swarmtroopers-controls button:active{transform:scale(.96)}
.swarmtroopers-controls button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media (hover:hover) and (pointer:fine){.swarmtroopers-controls button:not([aria-pressed=true]):hover{background:color-mix(in srgb,currentColor 8%,transparent)}}
@media (max-width:560px){.swarmtroopers-controls .swarmtroopers-controls-title{gap:0;padding:0 6px;font-size:0}.swarmtroopers-controls button{min-height:36px;padding-inline:10px;font-size:11px}}
@media print{.swarmtroopers-pending{opacity:1!important;pointer-events:auto!important}.swarmtroopers-overlay,.swarmtroopers-controls{display:none!important}}
@media (prefers-reduced-motion:reduce){.swarmtroopers-settle{animation:none}.swarmtroopers-pop,.swarmtroopers-controls button{transition:none!important}.swarmtroopers-controls button:active{transform:none}}
`;

let refs = 0;
let sheet: CSSStyleSheet | null = null;
let tag: HTMLStyleElement | null = null;

/** Adopted stylesheets go through CSSOM, which a strict style-src policy does not block. */
export function injectStyles(): boolean {
  refs++;
  if (sheet || tag) return sheet ? document.adoptedStyleSheets.includes(sheet) : !!tag?.sheet;
  try {
    const s = new CSSStyleSheet();
    s.replaceSync(CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
    sheet = s;
  } catch {
    tag = document.createElement('style');
    tag.id = 'swarmtroopers-styles';
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }
  return sheet ? document.adoptedStyleSheets.includes(sheet) : !!tag?.sheet;
}

export function releaseStyles(): void {
  if (refs === 0 || --refs > 0) return;
  if (sheet) {
    const s = sheet;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== s);
    sheet = null;
  }
  tag?.remove();
  tag = null;
}
