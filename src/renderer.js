// renderer.js — draws the world to a canvas with a camera (pan/zoom).
// Layers, back to front: scent haze, fertility biomes, food, creature glow,
// creature bodies (drawn procedurally from each genome), selection overlay,
// then a day/night tint + vignette.
import { CONFIG, SECTORS } from "./config.js";
import { TAU, clamp, hsl, lerp } from "./math.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.phCanvas = document.createElement("canvas");
    this.phCtx = this.phCanvas.getContext("2d");
    this.phImage = null;
    this.layers = { pheromone: true, biomes: true, names: false, vision: true };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.floor(r.width * this.dpr);
    this.canvas.height = Math.floor(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  fitTo(world) {
    const z = Math.min(this.W / world.width, this.H / world.height) * 0.96;
    this.cam.zoom = z;
    this.cam.x = world.width / 2;
    this.cam.y = world.height / 2;
  }

  worldToScreen(wx, wy) {
    return [(wx - this.cam.x) * this.cam.zoom + this.W / 2, (wy - this.cam.y) * this.cam.zoom + this.H / 2];
  }
  screenToWorld(sx, sy) {
    return [(sx - this.W / 2) / this.cam.zoom + this.cam.x, (sy - this.H / 2) / this.cam.zoom + this.cam.y];
  }

  _applyWorld() {
    const z = this.cam.zoom;
    this.ctx.setTransform(
      z * this.dpr, 0, 0, z * this.dpr,
      (this.W / 2 - this.cam.x * z) * this.dpr,
      (this.H / 2 - this.cam.y * z) * this.dpr
    );
  }
  _applyScreen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(world, selected) {
    const ctx = this.ctx;
    // clear (screen space)
    this._applyScreen();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = CONFIG.render.bg;
    ctx.fillRect(0, 0, this.W, this.H);

    this._applyWorld();

    // tank floor + border
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#0a0f17";
    ctx.fillRect(0, 0, world.width, world.height);

    if (this.layers.biomes) this._drawBiomes(world);
    if (this.layers.pheromone && CONFIG.render.showPheromone) this._drawPheromone(world);

    // border
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 2 / this.cam.zoom;
    ctx.strokeStyle = "rgba(120,150,190,0.25)";
    ctx.strokeRect(0, 0, world.width, world.height);

    this._drawFood(world);
    this._drawCreatureGlow(world);
    this._drawCreatureBodies(world, selected);
    if (selected && !selected.dead) this._drawSelection(selected);
    if (this.layers.names) this._drawNames(world);

    // day/night + vignette (screen space)
    this._applyScreen();
    this._drawAtmosphere(world);
  }

  _drawBiomes(world) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    for (const p of world.environment.patches) {
      const r = CONFIG.food.patchRadius;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const a = 0.05 * p.strength;
      g.addColorStop(0, `rgba(60,150,90,${a})`);
      g.addColorStop(1, "rgba(60,150,90,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }
  }

  _drawPheromone(world) {
    const f = world.field;
    if (this.phCanvas.width !== f.cols) { this.phCanvas.width = f.cols; this.phCanvas.height = f.rows; this.phImage = this.phCtx.createImageData(f.cols, f.rows); }
    const img = this.phImage, data = img.data;
    const n = f.cols * f.rows, K = 40;
    for (let i = 0; i < n; i++) {
      const r = f.r[i], g = f.g[i], b = f.b[i];
      const j = i * 4;
      data[j] = clamp(r * K, 0, 255);
      data[j + 1] = clamp(g * K, 0, 255);
      data[j + 2] = clamp(b * K, 0, 255);
      data[j + 3] = clamp((r + g + b) * K * 0.6, 0, 150);
    }
    this.phCtx.putImageData(img, 0, 0);
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.4;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.phCanvas, 0, 0, f.cols, f.rows, 0, 0, world.width, world.height);
    ctx.globalAlpha = 1;
  }

  _drawFood(world) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    // plants
    ctx.fillStyle = "rgba(120,230,150,0.9)";
    ctx.beginPath();
    for (const f of world.foods) {
      if (f.meat) continue;
      ctx.moveTo(f.x + f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, TAU);
    }
    ctx.fill();
    // carrion
    ctx.fillStyle = "rgba(220,90,70,0.85)";
    ctx.beginPath();
    for (const f of world.foods) {
      if (!f.meat) continue;
      ctx.moveTo(f.x + f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, TAU);
    }
    ctx.fill();
  }

  _drawCreatureGlow(world) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    for (const c of world.creatures) {
      const ef = clamp(c.energy / c.maxEnergy, 0, 1);
      ctx.fillStyle = hsl(c.hue, 0.8, 0.55, 0.10 + 0.10 * ef);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * 2.2, 0, TAU);
      ctx.fill();
    }
  }

  _drawCreatureBodies(world, selected) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    const detailed = this.cam.zoom > 0.35;
    for (const c of world.creatures) {
      this._drawBody(ctx, c, detailed, c === selected);
    }
  }

  _drawBody(ctx, c, detailed, isSel) {
    const ef = clamp(c.energy / c.maxEnergy, 0, 1);
    const len = c.size * c.elongation;
    const wid = c.size;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.heading);

    // body
    const light = 0.34 + 0.26 * ef;
    ctx.fillStyle = hsl(c.hue, 0.62, light);
    ctx.beginPath();
    ctx.ellipse(0, 0, len, wid, 0, 0, TAU);
    ctx.fill();

    // trophic-role outline: green (herbivore) -> red (carnivore)
    const roleHue = lerp(130, 0, c.diet);
    ctx.lineWidth = Math.max(0.6, c.size * 0.16);
    ctx.strokeStyle = hsl(roleHue, 0.85, 0.55, 0.9);
    ctx.stroke();

    if (detailed) {
      // armor spikes
      const spikes = Math.round(c.armor * 7);
      if (spikes > 0) {
        ctx.fillStyle = hsl(c.hue, 0.2, 0.8, 0.9);
        for (let i = 0; i < spikes; i++) {
          const a = (i / spikes) * TAU;
          const px = Math.cos(a) * len, py = Math.sin(a) * wid;
          const nx = Math.cos(a), ny = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(px + nx * c.size * 0.5, py + ny * c.size * 0.5);
          ctx.lineTo(px - ny * 1.2, py + nx * 1.2);
          ctx.lineTo(px + ny * 1.2, py - nx * 1.2);
          ctx.closePath(); ctx.fill();
        }
      }
      // tail/fin showing speed capacity
      const fin = (c.maxSpeed / 100) * len * 0.9;
      ctx.strokeStyle = hsl(c.hue, 0.5, 0.7, 0.5);
      ctx.lineWidth = Math.max(0.5, c.size * 0.1);
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - fin, 0); ctx.stroke();

      // eye near the front; size from sensor acuity
      const eye = clamp(c.sensorRange / 60, 0.8, 3);
      ctx.fillStyle = "rgba(245,250,255,0.95)";
      ctx.beginPath(); ctx.arc(len * 0.55, 0, eye, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(10,15,25,0.9)";
      ctx.beginPath(); ctx.arc(len * 0.62, 0, eye * 0.5, 0, TAU); ctx.fill();
    }

    // action flashes
    if (c.eatFlash > 0.06) { ctx.strokeStyle = `rgba(120,255,150,${c.eatFlash})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, len + 3, 0, TAU); ctx.stroke(); }
    if (c.attackFlash > 0.06) { ctx.strokeStyle = `rgba(255,90,70,${c.attackFlash})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, len + 4, 0, TAU); ctx.stroke(); }
    if (c.reproFlash > 0.06) { ctx.strokeStyle = `rgba(255,225,120,${c.reproFlash})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, len + 6, 0, TAU); ctx.stroke(); }

    ctx.restore();
  }

  _drawSelection(c) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    // vision cone
    if (this.layers.vision) {
      const half = c.sensorFOV / 2;
      ctx.fillStyle = "rgba(150,200,255,0.06)";
      ctx.strokeStyle = "rgba(150,200,255,0.18)";
      ctx.lineWidth = 1 / this.cam.zoom;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, c.sensorRange, c.heading - half, c.heading + half);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // sector dividers
      const sw = c.sensorFOV / SECTORS;
      ctx.strokeStyle = "rgba(150,200,255,0.10)";
      for (let s = 1; s < SECTORS; s++) {
        const a = c.heading - half + s * sw;
        ctx.beginPath(); ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(a) * c.sensorRange, c.y + Math.sin(a) * c.sensorRange);
        ctx.stroke();
      }
    }
    // pulsing ring
    const t = performance.now() / 400;
    const pr = c.size + 6 + Math.sin(t) * 2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5 / this.cam.zoom;
    ctx.beginPath(); ctx.arc(c.x, c.y, pr, 0, TAU); ctx.stroke();
  }

  _drawNames(world) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    ctx.font = `${(12 / this.cam.zoom).toFixed(1)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const off = 1 / this.cam.zoom;
    for (const s of world.registry.establishedLiving()) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(s.name, s.cx + off, s.cy + off);
      ctx.fillStyle = hsl(s.hue, 0.5, 0.85, 0.92);
      ctx.fillText(s.name, s.cx, s.cy);
    }
    ctx.textAlign = "left";
  }

  _drawAtmosphere(world) {
    const ctx = this.ctx;
    const cl = world.climateNow;
    // night cools and darkens; day adds faint warmth
    ctx.globalCompositeOperation = "source-over";
    const night = 1 - cl.light;
    if (night > 0.02) {
      ctx.fillStyle = `rgba(10,20,55,${0.45 * night})`;
      ctx.fillRect(0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = `rgba(255,220,160,${0.04 * cl.light})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    // vignette
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }
}
