(function () {
  var button = document.getElementById('demo-replay');
  var status = document.getElementById('demo-status');
  var options = {
    root: 'main',
    auto: true,
    inspect: true,
    plugins: ['tokens'],
    palette: ['#7DB4FF', '#B98CFF', '#5FE3D0', '#FF7EB6'],
    names: ['ada', 'mia', 'noé', 'iris'],
  };

  function start() {
    if (window.swarmtroopers) window.swarmtroopers.destroy();
    window.swarmtroopers = window.SwarmTroopers.create(options);
    window.SwarmTroopers.controls(window.swarmtroopers);
    status.textContent = window.swarmtroopers.quality === 'off' ? 'Motion off' : 'Swarm at work';
    window.swarmtroopers.on('done', function (result) {
      status.textContent = result.tasks + ' elements · page complete';
    });
    window.swarmtroopers.on('quality', function (result) {
      status.textContent = result.quality === 'off' ? 'Motion off' : 'Motion ' + result.quality;
    });
    window.dispatchEvent(new CustomEvent('swarmtroopers-ready', { detail: window.swarmtroopers }));
  }

  button.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'instant' });
    start();
  });
  start();
})();
