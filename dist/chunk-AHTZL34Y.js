/*! Swarm Troopers v0.4.0 | @mrvt/swarmtroopers | MIT */
import {
  SwarmTroopers,
  TOOLS
} from "./chunk-RRRAK5X3.js";

// src/index.ts
var version = true ? "0.4.0" : "dev";
function create(options) {
  return new SwarmTroopers(options);
}
function defineTool(name, tool) {
  TOOLS.set(name, tool);
}

export {
  version,
  create,
  defineTool
};
//# sourceMappingURL=chunk-AHTZL34Y.js.map
