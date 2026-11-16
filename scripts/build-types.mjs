import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' });
// CommonJS consumers need a matching declaration graph, not an ESM .d.ts behind require.
function copy(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    if (entry.isDirectory()) copy(source, join(to, entry.name));
    else if (entry.name.endsWith('.d.ts')) {
      const text = readFileSync(source, 'utf8').replace(/(['"])(\.\.?\/[^'"]+)\.js\1/g, '$1$2.cjs$1');
      writeFileSync(join(to, entry.name.replace(/\.d\.ts$/, '.d.cts')), text);
    }
  }
}
copy('dist/types', 'dist/types-cjs');
