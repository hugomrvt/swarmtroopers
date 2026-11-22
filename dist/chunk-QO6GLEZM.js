/*! Swarm Troopers v0.4.1 | swarmtroopers | MIT */
import {
  SwarmTroopers,
  TOOLS
} from "./chunk-K7YSAKZY.js";

// src/index.ts
var version = true ? "0.4.1" : "dev";
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
//# sourceMappingURL=chunk-QO6GLEZM.js.map
