const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarmtroopers-package-'));
try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp, '--cache', path.join(temp, 'npm-cache'), '--offline'], { cwd: root, encoding: 'utf8' }));
  const target = path.join(temp, 'node_modules/swarmtroopers'); fs.mkdirSync(target, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(temp, pack.filename), '-C', target, '--strip-components=1']);
  for (const [file, module, resolution] of [['input.mts', 'NodeNext', 'NodeNext'], ['input.cts', 'NodeNext', 'NodeNext'], ['bundler.mts', 'ESNext', 'Bundler']]) {
    fs.writeFileSync(path.join(temp, file), `import { create, SwarmTroopers, type SwarmTroopersOptions } from 'swarmtroopers';\nimport { create as full } from 'swarmtroopers/full';\nconst options: SwarmTroopersOptions = { root: 'main', auto: true };\nexport { create, SwarmTroopers, options, full };`);
    execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', module, '--moduleResolution', resolution, '--target', 'es2020', file], { cwd: temp, stdio: 'pipe' });
    console.log(`PASS  packed ${resolution} ${file} consumer`);
  }
  execFileSync(process.execPath, ['--input-type=module', '-e', 'const core=await import("swarmtroopers");await import("swarmtroopers/finale");const full=await import("swarmtroopers/full");await import("swarmtroopers/element");if(core.SwarmTroopers!==full.SwarmTroopers)throw Error("shared engine");'], { cwd: temp });
  execFileSync(process.execPath, ['-e', 'const core=require("swarmtroopers"),full=require("swarmtroopers/full");if(core.SwarmTroopers!==full.SwarmTroopers)throw Error("shared engine")'], { cwd: temp });
  const core = fs.readFileSync(path.join(target, 'dist/swarmtroopers.core.iife.js'));
  const full = fs.readFileSync(path.join(target, 'dist/swarmtroopers.iife.js'));
  assert(!core.includes('data:image/webp')); assert(full.includes('data:image/webp'));
  assert(gzipSync(core).length < 35 * 1024, 'lightweight script gzip budget');
  const source = fs.readFileSync(path.join(target, 'skills/swarmtroopers-overlay/SKILL.md'), 'utf8');
  assert(source.startsWith('---\nname: swarmtroopers-overlay\n')); assert(!/^version:|^author:/m.test(source));
  console.log(`PASS  SSR imports, optional artwork and core gzip budget (${gzipSync(core).length} bytes)`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
