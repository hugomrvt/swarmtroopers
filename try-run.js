// Builds any public page through /api/try in a fresh iframe that replaces `old`, and reports the run
// with the same messages as site-demo.html. A page whose own scripts navigate it away (often a router
// reading /api/try as its path) is rebuilt without them: that shows up as a 'left' message, a second
// load, or silence when the new address refuses to be framed.
// The only pages /api/try builds. Keep in sync with SITES in api/try.js.
// Shortest builds first: the landing runs the first one.
const TRY_SITES = [
  { label: 'hacker news', url: 'https://news.ycombinator.com' },
  { label: 'react.dev', url: 'https://react.dev' },
  { label: 'hugo.mourlev.at', url: 'https://hugo.mourlev.at' },
  { label: 'stripe', url: 'https://stripe.com' },
  { label: 'tailwind', url: 'https://tailwindcss.com' },
  { label: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Swarm_behaviour' },
];

function tryRun(old, value, report) {
  const frame = old.cloneNode(false);
  let scripts = true;
  let heard = false;
  let loads = 0;
  let timer = 0;

  const go = () => {
    heard = false;
    loads = 0;
    clearTimeout(timer);
    frame.src = '/api/try?url=' + encodeURIComponent(value) + (scripts ? '' : '&scripts=off');
  };
  const fallback = () => {
    if (!scripts) return;
    scripts = false;
    go();
    report({ state: 'retry' });
  };
  const onMessage = (event) => {
    const data = event.data;
    if (event.source !== frame.contentWindow || data?.type !== 'swarmtroopers-demo' || data.scene !== 'url') return;
    if (data.state === 'left') return fallback();
    heard = true;
    clearTimeout(timer);
    report(data);
  };

  frame.addEventListener('load', () => {
    if (++loads > 1) return fallback();
    if (heard) return;
    report({ state: 'loaded' });
    timer = setTimeout(fallback, 6000);
  });
  addEventListener('message', onMessage);
  go();
  old.replaceWith(frame);
  return {
    frame,
    stop() {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
    },
  };
}
