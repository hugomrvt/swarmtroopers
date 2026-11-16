/*! Swarm Troopers v0.4.0 | swarmtroopers | MIT */
import {
  SwarmTroopers,
  TOOLS
} from "./chunk-IVEBKNAV.js";

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
//# sourceMappingURL=chunk-RQK2C4QW.js.map
