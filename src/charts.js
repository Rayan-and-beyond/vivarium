// charts.js — small stacked live charts driven by world.history.
import { CONFIG } from "./config.js";

export class Charts {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.floor(r.width * this.dpr);
    this.canvas.height = Math.floor(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _panel(x, y, w, h, title, value, valColor) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(200,215,235,0.7)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textBaseline = "top";
    ctx.fillText(title, x + 8, y + 6);
    if (value != null) {
      ctx.fillStyle = valColor || "rgba(255,255,255,0.95)";
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText(value, x + w - 8, y + 5);
      ctx.textAlign = "left";
    }
  }

  _line(x, y, w, h, arr, color, minV, maxV, fill = false) {
    if (!arr || arr.length < 2) return;
    const ctx = this.ctx;
    const n = arr.length;
    const range = maxV - minV || 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = x + (i / (n - 1)) * w;
      const py = y + h - ((arr[i] - minV) / range) * h;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (fill) {
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  draw(world) {
    if (!this.W) this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    const h = world.history;
    const pad = 8;
    const panelH = (this.H - pad * 5) / 4;
    let y = pad;
    const x = pad, w = this.W - pad * 2;

    // population (scaled to cap)
    const maxPop = Math.max(CONFIG.world.maxCreatures * 0.6, Math.max(1, ...h.pop));
    this._panel(x, y, w, panelH, "POPULATION", world.stats.pop, "rgba(140,210,255,0.95)");
    this._line(x, y + 20, w, panelH - 26, h.pop, "rgba(120,200,255,0.95)", 0, maxPop, true);
    y += panelH + pad;

    // trophic mix (herbivore vs carnivore fraction)
    this._panel(x, y, w, panelH, "TROPHIC MIX  (herb / carn)",
      `${(world.stats.herbivoreFrac * 100) | 0}% / ${(world.stats.carnivoreFrac * 100) | 0}%`,
      "rgba(255,200,160,0.95)");
    this._line(x, y + 20, w, panelH - 26, h.herbivore, "rgba(120,235,150,0.9)", 0, 1);
    this._line(x, y + 20, w, panelH - 26, h.carnivore, "rgba(255,110,90,0.9)", 0, 1);
    y += panelH + pad;

    // species count
    const maxSp = Math.max(4, Math.max(1, ...h.species));
    this._panel(x, y, w, panelH, "LIVING SPECIES", world.stats.speciesCount, "rgba(200,170,255,0.95)");
    this._line(x, y + 20, w, panelH - 26, h.species, "rgba(190,150,255,0.95)", 0, maxSp, true);
    y += panelH + pad;

    // diversity (Shannon)
    const maxDiv = Math.max(1.5, Math.max(0.1, ...h.diversity));
    this._panel(x, y, w, panelH, "DIVERSITY  (Shannon H)", world.stats.diversity.toFixed(2), "rgba(255,230,150,0.95)");
    this._line(x, y + 20, w, panelH - 26, h.diversity, "rgba(255,225,140,0.95)", 0, maxDiv, true);
  }
}
