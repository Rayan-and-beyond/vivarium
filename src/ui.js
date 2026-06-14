// ui.js — wires the DOM controls and canvas interaction to the App.
import { CONFIG } from "./config.js";
import { clamp, TAU } from "./math.js";
import { Genome } from "./genome.js";
import { Creature } from "./creature.js";
import { Food } from "./food.js";

const $ = (id) => document.getElementById(id);

export function bindUI(app) {
  const r = app.renderer;
  const canvas = app.canvas;

  // ---- transport ----
  const playBtn = $("btn-play");
  const setPlay = () => { playBtn.textContent = app.state.paused ? "▶ Play" : "⏸ Pause"; playBtn.classList.toggle("on", !app.state.paused); };
  playBtn.onclick = () => { app.state.paused = !app.state.paused; setPlay(); };
  setPlay();

  // step one tick at a time (auto-pauses) — lets you watch a mind change frame by frame
  $("btn-step").onclick = () => { if (!app.state.paused) { app.state.paused = true; setPlay(); } app.world.step(); };

  const speed = $("speed");
  speed.min = 0; speed.max = CONFIG.sim.speeds.length - 1; speed.step = 1;
  speed.value = app.state.speedIndex;
  const speedLbl = $("speed-label");
  const setSpeedLbl = () => { speedLbl.textContent = CONFIG.sim.speeds[app.state.speedIndex] + "×"; };
  speed.oninput = () => { app.state.speedIndex = +speed.value; setSpeedLbl(); };
  setSpeedLbl();

  $("btn-reset").onclick = () => {
    const v = $("seed").value.trim();
    app.reset(v === "" ? 0 : (parseInt(v, 10) >>> 0));
  };
  $("btn-save").onclick = () => app.save();
  $("file-load").onchange = (e) => { if (e.target.files[0]) app.load(e.target.files[0]); e.target.value = ""; };

  const followBtn = $("btn-follow");
  followBtn.onclick = () => { app.state.follow = !app.state.follow; followBtn.classList.toggle("on", app.state.follow); };

  // ---- layer toggles ----
  const bindLayer = (id, key) => {
    const el = $(id);
    el.checked = r.layers[key];
    el.onchange = () => { r.layers[key] = el.checked; };
  };
  bindLayer("layer-pheromone", "pheromone");
  bindLayer("layer-biomes", "biomes");
  bindLayer("layer-vision", "vision");
  bindLayer("layer-names", "names");

  // ---- tabs ----
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const panels = { chronicle: $("panel-chronicle"), charts: $("panel-charts"), phylo: $("panel-phylo"), inspector: $("panel-inspector") };
  const setTab = (name) => {
    app.state.tab = name;
    for (const t of tabs) t.classList.toggle("on", t.dataset.tab === name);
    for (const k in panels) panels[k].classList.toggle("active", k === name);
    if (name === "charts") app.charts.resize();
    else if (name === "phylo") app.phylo.resize();
  };
  for (const t of tabs) t.onclick = () => setTab(t.dataset.tab);
  setTab("chronicle");

  // ---- god tools ----
  const toolBtns = [...document.querySelectorAll("[data-tool]")];
  const setTool = (name) => {
    app.state.tool = name;
    for (const b of toolBtns) b.classList.toggle("on", b.dataset.tool === name);
    canvas.style.cursor = name === "observe" ? "grab" : "crosshair";
  };
  for (const b of toolBtns) b.onclick = () => {
    const name = b.dataset.tool;
    if (name === "drought") { app.world.foods.length = 0; return; }
    setTool(app.state.tool === name ? "observe" : name);
  };
  setTool("observe");

  const applyTool = (wx, wy) => {
    const w = app.world;
    switch (app.state.tool) {
      case "meteor": {
        const R = 150;
        for (const c of w.creatures) if (Math.hypot(c.x - wx, c.y - wy) < R) { c.dead = true; c.deathCause = "cataclysm"; }
        break;
      }
      case "bloom": {
        const R = 130;
        for (let i = 0; i < 60; i++) {
          const a = w.rng.range(0, TAU), d = w.rng.range(0, R);
          const x = clamp(wx + Math.cos(a) * d, 1, w.width - 1), y = clamp(wy + Math.sin(a) * d, 1, w.height - 1);
          if (w.foods.length < CONFIG.food.maxFood + 200) w.foods.push(new Food(x, y, CONFIG.food.plantEnergy));
        }
        break;
      }
      case "spawn": {
        for (let i = 0; i < 4; i++) {
          const g = Genome.random(w.rng);
          const x = clamp(wx + w.rng.range(-20, 20), 1, w.width - 1), y = clamp(wy + w.rng.range(-20, 20), 1, w.height - 1);
          const c = new Creature(w, x, y, g, 1e9, 0, -1, 0);
          c.energy = c.maxEnergy * 0.6;
          c.speciesId = w.registry.assign(c, w.tick);
          w.creatures.push(c);
        }
        break;
      }
    }
  };

  // ---- camera / selection ----
  let down = false, moved = false, lastX = 0, lastY = 0, startX = 0, startY = 0;
  const localPos = (e) => { const rect = canvas.getBoundingClientRect(); return [e.clientX - rect.left, e.clientY - rect.top]; };

  canvas.addEventListener("pointerdown", (e) => {
    down = true; moved = false;
    const [mx, my] = localPos(e);
    lastX = startX = mx; lastY = startY = my;
    canvas.setPointerCapture(e.pointerId);
    if (app.state.tool === "observe") canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    const [mx, my] = localPos(e);
    if (down && app.state.tool === "observe") {
      const dx = mx - lastX, dy = my - lastY;
      if (Math.abs(mx - startX) + Math.abs(my - startY) > 4) moved = true;
      r.cam.x -= dx / r.cam.zoom; r.cam.y -= dy / r.cam.zoom;
    } else if (down) {
      if (Math.abs(mx - startX) + Math.abs(my - startY) > 4) moved = true;
    }
    lastX = mx; lastY = my;
  });
  canvas.addEventListener("pointerup", (e) => {
    down = false;
    if (app.state.tool === "observe") canvas.style.cursor = "grab";
    const [mx, my] = localPos(e);
    if (moved) return; // it was a drag, not a click
    const [wx, wy] = r.screenToWorld(mx, my);
    if (app.state.tool === "observe") {
      const c = app.world.pickCreature(wx, wy);
      app.state.selected = c;
      if (c) setTab("inspector");
    } else {
      applyTool(wx, wy);
    }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [mx, my] = localPos(e);
    const [wx, wy] = r.screenToWorld(mx, my);
    const factor = Math.exp(-e.deltaY * 0.0012);
    r.cam.zoom = clamp(r.cam.zoom * factor, 0.08, 6);
    r.cam.x = wx - (mx - r.W / 2) / r.cam.zoom;
    r.cam.y = wy - (my - r.H / 2) / r.cam.zoom;
  }, { passive: false });

  // ---- keyboard ----
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); app.state.paused = !app.state.paused; setPlay(); }
    else if (e.key === "f") { app.state.follow = !app.state.follow; followBtn.classList.toggle("on", app.state.follow); }
    else if (e.key === "+" || e.key === "=") { app.state.speedIndex = Math.min(CONFIG.sim.speeds.length - 1, app.state.speedIndex + 1); speed.value = app.state.speedIndex; setSpeedLbl(); }
    else if (e.key === "-") { app.state.speedIndex = Math.max(0, app.state.speedIndex - 1); speed.value = app.state.speedIndex; setSpeedLbl(); }
  });
}
