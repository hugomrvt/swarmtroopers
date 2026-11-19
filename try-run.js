// Example sites, frozen by scripts/snapshot-sites.mjs: their own scripts are gone, so every run is quick
// and smooth. The landing runs the first one.
const TRY_SITES = [
  { label: 'hacker news', url: 'https://news.ycombinator.com', file: 'sites/hn.html' },
  { label: 'react.dev', url: 'https://react.dev', file: 'sites/react.html' },
  { label: 'hugo.mourlev.at', url: 'https://hugo.mourlev.at', file: 'sites/hugo.html' },
];

// Loads a snapshot in a fresh iframe that replaces `old` (so stale messages cannot leak into a new run)
// and reports its run with the same messages as site-demo.html.
function tryRun(old, site, report) {
  const frame = old.cloneNode(false);
  let heard = false;
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow || event.data?.type !== 'swarmtroopers-demo' || event.data.scene !== 'url') return;
    heard = true;
    report(event.data);
  };
  // The load event can come after the build started (late images); it only matters before that.
  frame.addEventListener('load', () => heard || report({ state: 'loaded' }), { once: true });
  addEventListener('message', onMessage);
  frame.src = site.file;
  old.replaceWith(frame);
  return { frame, stop: () => removeEventListener('message', onMessage) };
}
