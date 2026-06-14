// main.js — boots the app, owns the render/step loop, and pushes state into
// the renderer, charts, tree, inspector, chronicle and HUD each frame.
import { CONFIG } from "./config.js";
import { fmt } from "./math.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { Charts } from "./charts.js";
import { Phylo } from "./phylo.js";
import { Inspector } from "./inspector.js";
import { downloadWorld, deserialize } from "./persistence.js";
import { bindUI } from "./ui.js";

const $ = (id) => document.getElementById(id);

class App {
  constructor() {
    this.canvas = $("world");
    this.renderer = new Renderer(this.canvas);
    this.charts = new Charts($("charts"));
    this.phylo = new Phylo($("phylo"));
    this.inspector = new Inspector($("inspector"));

    this.state = {
      paused: false,
      speedIndex: Math.max(0, CONFIG.sim.speeds.indexOf(CONFIG.sim.defaultSpeed)),
      follow: false,
      selected: null,
      tab: "chronicle",
      tool: "observe",
    };

    const seed = (Math.random() * 1e9) | 0;
    this.world = new World(seed);
    this.renderer.resize();
    this.renderer.fitTo(this.world);
    this.charts.resize();
    this.phylo.resize();

    this.fps = 0; this._frames = 0; this._fpsT = performance.now();
    this._chronSig = "";

    bindUI(this);
    window.addEventListener("resize", () => this.onResize());
    this.updateChronicle(true);
    requestAnimationFrame(this.loop);
  }

  get speed() { return CONFIG.sim.speeds[this.state.speedIndex]; }

  onResize() { this.renderer.resize(); this.charts.resize(); this.phylo.resize(); }

  reset(seed) {
    const s = (seed >>> 0) || ((Math.random() * 1e9) | 0);
    this.world = new World(s);
    this.state.selected = null;
    this.renderer.fitTo(this.world);
    this.updateChronicle(true);
  }

  save() { downloadWorld(this.world); }

  async load(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      this.world = deserialize(data);
      this.state.selected = null;
      this.renderer.fitTo(this.world);
      this.updateChronicle(true);
    } catch (e) {
      console.error("load failed", e);
      alert("Could not load that file: " + e.message);
    }
  }

  loop = (t) => {
    if (!this.state.paused) {
      const n = this.speed;
      for (let i = 0; i < n; i++) this.world.step();
    }
    const sel = this.state.selected;
    if (this.state.follow && sel && !sel.dead) {
      this.renderer.cam.x = sel.x; this.renderer.cam.y = sel.y;
    }
    this.renderer.draw(this.world, sel);
    this.inspector.update(sel, this.world);

    if (this.state.tab === "charts") this.charts.draw(this.world);
    else if (this.state.tab === "phylo") this.phylo.draw(this.world);

    this.updateChronicle();
    this.updateHUD();

    this._frames++;
    if (t - this._fpsT > 500) {
      this.fps = Math.round((this._frames * 1000) / (t - this._fpsT));
      this._frames = 0; this._fpsT = t;
    }
    requestAnimationFrame(this.loop);
  };

  updateHUD() {
    const w = this.world, s = w.stats, cl = w.climateNow;
    $("hud-day").textContent = Math.floor(w.time / CONFIG.climate.dayLength);
    $("hud-pop").textContent = fmt(s.pop);
    $("hud-species").textContent = fmt(s.speciesCount);
    $("hud-food").textContent = fmt(s.foodCount);
    $("hud-gen").textContent = fmt(w.stats.totalBirths);
    $("hud-season").textContent = `${cl.isNight ? "☾" : "☀"} ${cl.seasonName}`;
    $("hud-fps").textContent = this.fps;
    $("hud-speed").textContent = this.state.paused ? "paused" : `${this.speed}×`;
  }

  updateChronicle(force = false) {
    const entries = this.world.chronicler.entries;
    const sig = entries.length + ":" + (entries.length ? entries[entries.length - 1].tick : 0);
    if (!force && sig === this._chronSig) return;
    this._chronSig = sig;
    const el = $("chronicle");
    let html = "";
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      html += `<div class="chron-entry ${e.kind}"><span class="chron-day">Day ${e.day}</span>${e.text}</div>`;
    }
    el.innerHTML = html;
  }
}

window.addEventListener("DOMContentLoaded", () => { window.app = new App(); });
