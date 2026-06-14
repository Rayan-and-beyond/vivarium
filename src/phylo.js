// phylo.js — a phylogenetic tree of life. Each species is a horizontal segment
// across time (birth -> extinction/now); children branch off their parent's
// row at the moment they diverged. Living lineages glow; extinct ones fade.
import { CONFIG } from "./config.js";
import { hsl } from "./math.js";

export class Phylo {
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

  draw(world) {
    if (!this.W) this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    const all = [...world.registry.species.values()].filter((s) => s.peak >= CONFIG.species.establishedMin);
    if (all.length === 0) {
      ctx.fillStyle = "rgba(170,190,215,0.5)";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText("No established lineages yet — the tree will grow here.", 14, 28);
      return;
    }

    // keep the most significant lineages readable
    let list = all;
    const LIMIT = 64;
    if (all.length > LIMIT) list = [...all].sort((a, b) => b.peak - a.peak).slice(0, LIMIT);
    const idset = new Set(list.map((s) => s.id));

    const children = new Map();
    for (const s of list) {
      const p = idset.has(s.parentSpecies) ? s.parentSpecies : null;
      if (p != null) { if (!children.has(p)) children.set(p, []); children.get(p).push(s); }
    }
    const roots = list.filter((s) => !idset.has(s.parentSpecies)).sort((a, b) => a.birthTick - b.birthTick);

    const rowOf = new Map();
    let row = 0;
    const visit = (s) => {
      rowOf.set(s.id, row++);
      const ch = children.get(s.id);
      if (ch) { ch.sort((a, b) => a.birthTick - b.birthTick); for (const c of ch) visit(c); }
    };
    for (const r of roots) visit(r);
    const rows = Math.max(1, row);

    const maxTick = Math.max(1, world.tick);
    const mL = 10, mR = 90, mT = 12, mB = 18;
    const w = this.W - mL - mR, hh = this.H - mT - mB;
    const rowH = Math.min(22, hh / rows);
    const X = (t) => mL + (t / maxTick) * w;
    const Y = (r) => mT + r * rowH + rowH / 2;

    // connectors parent -> child
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(180,200,230,0.18)";
    for (const s of list) {
      if (!idset.has(s.parentSpecies)) continue;
      const py = Y(rowOf.get(s.parentSpecies)), cy = Y(rowOf.get(s.id)), cx = X(s.birthTick);
      ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(cx, cy); ctx.stroke();
    }

    // lifelines
    for (const s of list) {
      const y = Y(rowOf.get(s.id));
      const x0 = X(s.birthTick), x1 = X(s.deathTick ?? world.tick);
      const alive = s.count > 0;
      ctx.strokeStyle = hsl(s.hue, 0.6, alive ? 0.62 : 0.34, alive ? 0.95 : 0.5);
      ctx.lineWidth = Math.max(1.5, Math.min(6, Math.log2(s.peak + 1)));
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.max(x1, x0 + 2), y); ctx.stroke();
      if (alive && rowH >= 9) {
        ctx.fillStyle = "rgba(225,235,250,0.85)";
        ctx.font = "9px ui-monospace, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(s.name.length > 16 ? s.name.slice(0, 15) + "…" : s.name, Math.min(x1 + 5, this.W - mR + 2), y);
      }
    }

    ctx.fillStyle = "rgba(160,180,210,0.5)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("time →", mL, this.H - 4);
  }
}
