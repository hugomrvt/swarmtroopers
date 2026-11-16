/*! Swarm Troopers v0.4.0 | @mrvt/swarmtroopers | MIT */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/finale-art.ts
var finale_art_exports = {};
__export(finale_art_exports, {
  getFinaleArtwork: () => getFinaleArtwork,
  setFinaleArtwork: () => setFinaleArtwork
});
module.exports = __toCommonJS(finale_art_exports);
var artwork = null;
var getFinaleArtwork = () => artwork;
function setFinaleArtwork(value) {
  artwork = value;
}
