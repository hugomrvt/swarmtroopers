import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dir = new URL('../dist/', import.meta.url);
const kb = (n) => (n / 1024).toFixed(1).padStart(6) + ' KB';

for (const name of readdirSync(dir).filter((f) => /\.(js|cjs)$/.test(f)).sort()) {
  const buf = readFileSync(new URL(name, dir));
  console.log(`${name.padEnd(28)} ${kb(buf.length)}  gzip ${kb(gzipSync(buf, { level: 9 }).length)}`);
}
