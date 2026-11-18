(() => {
  const badges = [...document.querySelectorAll('[data-github-stars]')];
  if (!badges.length) return;
  const format = new Intl.NumberFormat('en-US');
  // ponytail: polls the public API (60 req/h per visitor IP); a cached /api/stars proxy if that ever runs short.
  const REFRESH_MS = 120_000;
  let last = 0;

  function update(state, count) {
    const ready = state === 'ready';
    // A failed refresh keeps the last good count instead of blanking it.
    if (!ready && badges[0].dataset.state === 'ready') return;
    const label = ready ? `${format.format(count)} ${count === 1 ? 'star' : 'stars'}` : 'Star count unavailable';
    for (const badge of badges) {
      badge.dataset.state = state;
      badge.querySelector('[data-github-count]').textContent = ready ? format.format(count) : '—';
      badge.setAttribute('aria-label', `Swarm Troopers on GitHub: ${label}`);
      badge.title = label;
    }
  }

  function refresh() {
    if (document.hidden || Date.now() - last < REFRESH_MS / 2) return;
    last = Date.now();
    fetch('https://api.github.com/repos/hugomrvt/swarmtroopers', {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000),
    }).then(async (response) => {
      if (!response.ok) return update('unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0) return update('unavailable');
      update('ready', data.stargazers_count);
    }).catch(() => update('unavailable'));
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', refresh);
})();
