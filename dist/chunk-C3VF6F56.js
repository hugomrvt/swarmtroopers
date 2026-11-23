/*! Swarm Troopers v0.5.1 | swarmtroopers | MIT */
import {
  SwarmTroopers,
  TOOLS
} from "./chunk-XPJSWSA7.js";

// src/index.ts
var version = true ? "0.5.1" : "dev";
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
//# sourceMappingURL=chunk-C3VF6F56.js.map
