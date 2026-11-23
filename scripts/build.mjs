import { build, context } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const watch = process.argv.includes('--watch');

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });

const common = {
  bundle: true,
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'info',
  loader: { '.svg': 'dataurl' },
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: `/*! Swarm Troopers v${version} | swarmtroopers | MIT */` },
};
// Classic scripts expose the module as window.SwarmTroopers.
const script = { ...common, format: 'iife', globalName: 'SwarmTroopers', minify: true };

// The CommonJS full alias reuses the core engine.
const cjsCore = {
  name: 'shared-cjs-engine',
  setup(build) {
    build.onResolve({ filter: /^\.\/index\.js$/ }, () => ({ path: './swarmtroopers.cjs', external: true }));
  },
};

const builds = [
  // ES modules for bundlers, with the custom element as a separate entry.
  { ...common, entryPoints: { swarmtroopers: 'src/index.ts', element: 'src/element.ts', finale: 'src/finale.ts', full: 'src/full.ts' }, format: 'esm', splitting: true, outdir: 'dist', sourcemap: true },
  // CommonJS for older toolchains.
  { ...common, entryPoints: ['src/index.ts'], format: 'cjs', outfile: 'dist/swarmtroopers.cjs', sourcemap: true, },
  { ...common, entryPoints: ['src/full.ts'], format: 'cjs', outfile: 'dist/full.cjs', sourcemap: true, plugins: [cjsCore] },
  // Classic scripts; the full one is an alias of the core kept for 0.5.0 URLs.
  { ...script, entryPoints: ['src/iife.ts'], outfile: 'dist/swarmtroopers.core.iife.js' },
  { ...script, entryPoints: ['src/full-iife.ts'], outfile: 'dist/swarmtroopers.iife.js' },
];

if (watch) {
  for (const options of builds) await (await context(options)).watch();
} else {
  await Promise.all(builds.map((options) => build(options)));
}
