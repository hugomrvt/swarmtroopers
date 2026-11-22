/*! Swarm Troopers v0.5.0 | swarmtroopers | MIT */
import {
  SwarmTroopers,
  TOOLS
} from "./chunk-EQXGE2WT.js";

// src/index.ts
var version = true ? "0.5.0" : "dev";
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
//# sourceMappingURL=chunk-BSBFW2VA.js.map
