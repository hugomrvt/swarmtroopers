// The full-page example, a made-up product page built for the demo: self-contained, so every run is
// quick, smooth and the same. Used by the landing playground and by try.html.
const TRY_DEMO = { label: 'tidewell', file: 'sites/demo.html' };
function tryRun(old, report) {
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
  frame.src = TRY_DEMO.file;
  old.replaceWith(frame);
  return { frame, stop: () => removeEventListener('message', onMessage) };
}
