const menu = document.querySelector('#docs-menu');
const compact = matchMedia('(max-width: 850px)');
const syncMenu = () => { menu.open = !compact.matches; };
syncMenu();
compact.addEventListener('change', syncMenu);

const search = document.querySelector('#docs-search');
const results = document.querySelector('#docs-search-results');
const searchStatus = document.querySelector('#docs-search-status');
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let indexPromise;
let queryVersion = 0;

async function findPages() {
  const version = ++queryVersion;
  const query = search.value.trim().slice(0, 120);
  results.replaceChildren();
  results.hidden = true;
  searchStatus.textContent = '';
  if (!query) return;
  searchStatus.textContent = 'Searching…';
  try {
    indexPromise ??= fetch('search.json', { credentials: 'same-origin' }).then(response => {
      if (!response.ok) throw new Error('Documentation index unavailable');
      return response.json();
    });
    const index = await indexPromise;
    if (version !== queryVersion) return;
    const words = normalize(query).split(/\s+/);
    const matches = index.filter(page => words.every(word => normalize(`${page.title} ${page.description} ${page.text}`).includes(word))).sort((a, b) => Number(normalize(b.title).includes(normalize(query))) - Number(normalize(a.title).includes(normalize(query))));
    searchStatus.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'page' : 'pages'} found${matches.length > 8 ? '. Showing the first 8.' : '.'}` : 'No matching pages. Try a method, option, or framework name.';
    for (const page of matches.slice(0, 8)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = page.url;
      const title = document.createElement('strong');
      title.textContent = page.title;
      const excerpt = document.createElement('p');
      const offset = normalize(page.text).indexOf(words[0]);
      const start = Math.max(0, offset - 36);
      excerpt.textContent = `${start ? '…' : ''}${page.text.slice(start, start + 145)}${page.text.length > start + 145 ? '…' : ''}`;
      link.append(title, excerpt);
      item.append(link);
      results.append(item);
    }
    results.hidden = matches.length === 0;
  } catch {
    if (version === queryVersion) searchStatus.textContent = 'Search is unavailable. Browse the documentation below.';
  }
}

search.addEventListener('input', findPages);
if (!/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelector('.search-input kbd').textContent = 'Ctrl K';
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    search.focus();
    search.select();
  }
});
search.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    search.value = '';
    findPages();
  }
  if (event.key === 'Enter' && results.querySelector('a')) {
    event.preventDefault();
    results.querySelector('a').click();
  }
});

const copyTimers = new WeakMap();
document.querySelectorAll('.copy-code').forEach(button => {
  button.addEventListener('click', async () => {
    const block = button.closest('.code-block');
    const pre = block.querySelector('pre');
    const code = pre.querySelector('code') || pre;
    const status = block.querySelector('.copy-status');
    clearTimeout(copyTimers.get(button));
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.querySelector('span').textContent = 'copied';
      status.textContent = 'Code copied to the clipboard.';
      copyTimers.set(button, setTimeout(() => {
        button.querySelector('span').textContent = 'copy';
        status.textContent = '';
      }, 2200));
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      pre.focus();
      status.textContent = 'Code selected. Press Ctrl+C or ⌘C to copy.';
    }
  });
});

document.querySelectorAll('.example-replay').forEach(button => {
  button.addEventListener('click', () => {
    const frame = button.closest('.docs-example').querySelector('iframe');
    const url = new URL(frame.src, location.href);
    url.searchParams.set('replay', Date.now());
    frame.src = url.href;
    frame.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
});

const tocLinks = [...document.querySelectorAll('.docs-toc a')];
if (typeof IntersectionObserver !== 'undefined' && tocLinks.length) {
  const observer = new IntersectionObserver(entries => {
    const current = entries.find(entry => entry.isIntersecting);
    if (!current) return;
    for (const link of tocLinks) {
      if (link.hash === `#${current.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-100px 0px -65% 0px' });
  for (const link of tocLinks) {
    const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (heading) observer.observe(heading);
  }
}
