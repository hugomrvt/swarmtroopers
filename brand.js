(() => {
  const badges = [...document.querySelectorAll('[data-github-stars]')];
  if (!badges.length) return;
  const links = [...document.querySelectorAll('[data-github-link]')];
  const repository = 'https://github.com/hugomrvt/swarmtroopers';
  const format = new Intl.NumberFormat('en-US');

  function update(state, count) {
    const ready = state === 'ready';
    const label = ready ? `${format.format(count)} ${count === 1 ? 'star' : 'stars'}` : state === 'unpublished' ? 'Repository not published yet' : 'Star count unavailable';
    for (const badge of badges) {
      badge.dataset.state = state;
      badge.querySelector('[data-github-count]').textContent = ready ? format.format(count) : state === 'unpublished' ? 'Not published' : '—';
      badge.setAttribute('aria-label', `Swarm Troopers on GitHub: ${label}`);
      badge.title = label;
    }
    for (const link of links) {
      if (ready) {
        link.href = repository + (link.dataset.githubLink === 'readme' ? '#readme' : '');
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
        link.removeAttribute('role');
      } else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
        link.setAttribute('role', 'link');
      }
      link.title = label;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  fetch('https://api.github.com/repos/hugomrvt/swarmtroopers', {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
    signal: controller.signal,
  }).then(async (response) => {
    if (response.status === 404) return update('unpublished');
    if (!response.ok) return update('unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0) return update('unavailable');
    update('ready', data.stargazers_count);
  }).catch(() => update('unavailable')).finally(() => clearTimeout(timeout));
})();
