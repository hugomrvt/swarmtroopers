#!/usr/bin/env node
import { cpSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => args.indexOf(name);
if (cmd !== "skill") {
  console.error("usage: swarmtroopers skill [--global] [--dir <path>]");
  process.exit(1);
}
const source = fileURLToPath(new URL("../skills/swarmtroopers-overlay", import.meta.url));
const dir = flag("--dir") >= 0 ? resolve(args[flag("--dir") + 1] ?? ".") : flag("--global") >= 0 ? join(homedir(), ".claude/skills") : resolve(".claude/skills");
const target = join(dir, "swarmtroopers-overlay");
cpSync(source, target, { recursive: true });
console.log(`installed skill to ${target}`);
