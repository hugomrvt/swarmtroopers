/*! Swarm Troopers v0.5.0 | swarmtroopers | MIT */
import {
  SwarmTroopers,
  controls
} from "./chunk-EQXGE2WT.js";
import "./chunk-2UYDPHDG.js";

// src/element.ts
var Base = typeof HTMLElement === "undefined" ? class {
} : HTMLElement;
var SwarmTroopersOverlayElement = class extends Base {
  constructor() {
    super(...arguments);
    this.swarmtroopers = null;
    this.pendingStart = null;
  }
  connectedCallback() {
    this.style.display = "none";
    if (this.swarmtroopers) return;
    const on = (name) => this.hasAttribute(name) && this.getAttribute(name) !== "false";
    const positive = (name) => {
      const value = parseFloat(this.getAttribute(name) ?? "");
      return Number.isFinite(value) && value > 0 ? value : void 0;
    };
    const choice = (name, values) => values.find((value) => value === this.getAttribute(name));
    const options = {
      root: this.getAttribute("root"),
      selector: this.getAttribute("selector") ?? void 0,
      auto: on("auto"),
      inspect: on("inspect"),
      labels: this.getAttribute("labels") !== "false",
      quality: choice("quality", ["auto", "full", "light", "off"]),
      trigger: choice("trigger", ["immediate", "scroll", "manual"]),
      speed: positive("speed"),
      once: this.getAttribute("once") === "session" ? "session" : false,
      plugins: on("tokens") ? ["tokens"] : [],
      chat: this.hasAttribute("chat") && this.getAttribute("chat") !== "false",
      locale: this.getAttribute("lang") || void 0,
      names: names(this.getAttribute("names")),
      finale: this.getAttribute("finale") !== "false",
      scale: positive("scale")
    };
    const start = () => {
      if (this.pendingStart !== start) return;
      this.pendingStart = null;
      if (!this.isConnected || this.swarmtroopers) return;
      try {
        this.swarmtroopers = new SwarmTroopers(options);
        if (on("controls")) {
          const value = this.getAttribute("controls") ?? "";
          const position = /^(bottom|top)-(left|right)$/.test(value) ? value : void 0;
          controls(this.swarmtroopers, { position });
        }
        this.dispatchEvent(new CustomEvent("swarmtroopers-ready", { detail: this.swarmtroopers, bubbles: true }));
      } catch (error) {
        this.swarmtroopers?.destroy();
        this.swarmtroopers = null;
        document.documentElement.classList.remove("swarmtroopers-preload");
        console.warn("[swarmtroopers] custom element could not initialize; content restored", error);
      }
    };
    this.pendingStart = start;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else queueMicrotask(start);
  }
  disconnectedCallback() {
    if (this.pendingStart) document.removeEventListener("DOMContentLoaded", this.pendingStart);
    this.pendingStart = null;
    this.swarmtroopers?.destroy();
    this.swarmtroopers = null;
  }
};
function defineElement(name = "swarmtroopers-overlay") {
  if (typeof customElements !== "undefined" && !customElements.get(name)) customElements.define(name, SwarmTroopersOverlayElement);
}
defineElement();
function names(value) {
  if (value === "false") return false;
  const list = (value ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  return list.length > 1 ? list : true;
}
export {
  SwarmTroopersOverlayElement,
  defineElement
};
//# sourceMappingURL=element.js.map
